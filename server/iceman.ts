/**
 * ICEMAN — batch Nearmap imagery → XLSX with embedded thumbnails.
 *
 * Env: NEARMAP_API_KEY
 *
 * Output images per row:
 *   - Top-down (vertical): ~100 m ground coverage (fixed)
 *   - Close north oblique: 15–50 m ground coverage (default 30 m)
 *   - Far north oblique:   200–500 m ground coverage (default 300 m)
 */

import ExcelJS from 'exceljs';
import Jimp from 'jimp';
import { Readable } from 'stream';
import { fetchWithTimeout } from './fetchWithTimeout';

const NEARMAP_TILES_BASE = 'https://api.nearmap.com/tiles/v3';
const NEARMAP_COVERAGE_BASE = 'https://api.nearmap.com/coverage/v2';
/** Pause between row batches (not between a row's tiles) to stay polite to Nearmap. */
const REQUEST_DELAY_MS = 200;
/** Rows processed concurrently per batch; each row still fetches its three tiles in parallel. */
const ROW_CONCURRENCY = 3;
const NEARMAP_TIMEOUT_MS = 15_000;
const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 120;
const THUMB_JPEG_QUALITY = 80;

/**
 * Hard server-side row cap. Amplify's proxy times out around 30 s, so the handler clamps
 * `max_rows` to this. MAX_ROWS in src/components/Iceman.tsx must match.
 */
export const ICEMAN_MAX_ROWS = 15;
const DEFAULT_MAX_ROWS = ICEMAN_MAX_ROWS;

/** Approximate tile ground width (m) → Web Mercator zoom. */
const EARTH_CIRCUMFERENCE_M = 40075016.686;

export const CLOSE_OBLIQUE_MIN_M = 15;
export const CLOSE_OBLIQUE_MAX_M = 50;
export const CLOSE_OBLIQUE_DEFAULT_M = 30;

export const FAR_OBLIQUE_MIN_M = 200;
export const FAR_OBLIQUE_MAX_M = 500;
export const FAR_OBLIQUE_DEFAULT_M = 300;

export const TOP_DOWN_M = 100;

export type IcemanRow = {
  lat: number;
  lng: number;
  passThrough: Record<string, string | number | boolean | null>;
};

export type IcemanImageOptions = {
  closeObliqueMeters?: number;
  farObliqueMeters?: number;
};

type ImageShot = {
  key: 'topDown' | 'close' | 'far';
  contentType: 'Vert' | 'North';
  meters: number;
  label: string;
};

type ImageFetchResult = {
  buffer: Buffer | null;
  note?: string;
};

type CoverageSurvey = {
  id?: string;
  captureDate?: string;
  resources?: { tiles?: { type?: string }[] };
};

/** Newest survey id per tile type; obliques are often captured less often than verticals. */
type SurveyIdsByType = Partial<Record<ImageShot['contentType'], string>>;

type CoverageResult = { surveyIds: SurveyIdsByType; note?: string };

type CellPrimitive = string | number | boolean | null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function requireNearmapKey(): string {
  const key = process.env.NEARMAP_API_KEY?.trim();
  if (!key) throw new Error('Missing required env var: NEARMAP_API_KEY');
  return key;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizeIcemanImageOptions(raw?: IcemanImageOptions): {
  closeObliqueMeters: number;
  farObliqueMeters: number;
} {
  const closeRaw = Number(raw?.closeObliqueMeters);
  const farRaw = Number(raw?.farObliqueMeters);
  return {
    closeObliqueMeters: Number.isFinite(closeRaw)
      ? Math.round(clamp(closeRaw, CLOSE_OBLIQUE_MIN_M, CLOSE_OBLIQUE_MAX_M))
      : CLOSE_OBLIQUE_DEFAULT_M,
    farObliqueMeters: Number.isFinite(farRaw)
      ? Math.round(clamp(farRaw, FAR_OBLIQUE_MIN_M, FAR_OBLIQUE_MAX_M))
      : FAR_OBLIQUE_DEFAULT_M,
  };
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function findLatLngColumns(headers: string[]): { latCol: string; lngCol: string } | null {
  const latNames = new Set(['lat', 'latitude', 'y']);
  const lngNames = new Set(['lng', 'lon', 'long', 'longitude', 'x']);

  let latCol: string | undefined;
  let lngCol: string | undefined;

  for (const header of headers) {
    const norm = normalizeHeader(header);
    if (!latCol && latNames.has(norm)) latCol = header;
    if (!lngCol && lngNames.has(norm)) lngCol = header;
  }

  if (!latCol || !lngCol) return null;
  return { latCol, lngCol };
}

function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

/** Ground width of one 256px Web Mercator tile at latitude / zoom. */
function tileGroundWidthMeters(lat: number, zoom: number): number {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  return (EARTH_CIRCUMFERENCE_M * Math.max(0.01, cosLat)) / 2 ** zoom;
}

/**
 * Pick integer zoom whose tile ground width is closest to the requested meters.
 * Nearmap typically tops out around zoom 21 for high-res surveys.
 */
function zoomForGroundCoverageMeters(lat: number, targetMeters: number): number {
  const target = Math.max(1, targetMeters);
  let bestZoom = 19;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let z = 14; z <= 21; z++) {
    const width = tileGroundWidthMeters(lat, z);
    const diff = Math.abs(width - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestZoom = z;
    }
  }
  return bestZoom;
}

async function getLatestSurveyIds(
  lat: number,
  lng: number,
  apiKey: string
): Promise<CoverageResult> {
  const coord = `${lng},${lat}`;
  const url = `${NEARMAP_COVERAGE_BASE}/point/${encodeURIComponent(coord)}?apikey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetchWithTimeout(url, {}, NEARMAP_TIMEOUT_MS);
    if (!res.ok) {
      return { surveyIds: {}, note: `Coverage ${res.status}` };
    }
    const data = (await res.json()) as { surveys?: CoverageSurvey[] };
    const surveys = Array.isArray(data.surveys) ? data.surveys : [];
    if (!surveys.length) {
      return { surveyIds: {}, note: 'No coverage' };
    }

    const sorted = [...surveys].sort((a, b) => {
      const da = a.captureDate ? Date.parse(a.captureDate) : 0;
      const db = b.captureDate ? Date.parse(b.captureDate) : 0;
      return db - da;
    });

    const surveyIds: SurveyIdsByType = {};
    for (const survey of sorted) {
      if (!survey.id) continue;
      for (const tile of survey.resources?.tiles ?? []) {
        if ((tile.type === 'Vert' || tile.type === 'North') && !surveyIds[tile.type]) {
          surveyIds[tile.type] = survey.id;
        }
      }
    }
    return { surveyIds };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Coverage failed';
    console.error('[iceman] coverage error', lat, lng, msg);
    return { surveyIds: {}, note: msg };
  }
}

async function fetchTile(
  lat: number,
  lng: number,
  meters: number,
  label: string,
  contentType: ImageShot['contentType'],
  apiKey: string,
  surveyId: string | undefined
): Promise<ImageFetchResult> {
  const zoom = zoomForGroundCoverageMeters(lat, meters);
  const { x, y } = latLngToTile(lat, lng, zoom);

  const path = surveyId
    ? `surveys/${surveyId}/${contentType}/${zoom}/${x}/${y}.jpg`
    : `${contentType}/${zoom}/${x}/${y}.jpg`;

  const url = `${NEARMAP_TILES_BASE}/${path}?apikey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetchWithTimeout(url, {}, NEARMAP_TIMEOUT_MS);
    if (!res.ok) {
      return { buffer: null, note: `${label} ${res.status}` };
    }
    const arrayBuf = await res.arrayBuffer();
    const raw = Buffer.from(arrayBuf);
    if (!raw.length) {
      return { buffer: null, note: `${label} empty` };
    }

    const image = await Jimp.read(raw);
    // Nearmap panorama tiles display correctly at 256×192 (foreshortening).
    image.cover(THUMB_WIDTH, THUMB_HEIGHT).quality(THUMB_JPEG_QUALITY);
    const thumb = await image.getBufferAsync(Jimp.MIME_JPEG);
    return { buffer: thumb };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Tile fetch failed';
    console.error('[iceman] tile error', label, lat, lng, msg);
    return { buffer: null, note: `${label}: ${msg}` };
  }
}

/** Flatten an ExcelJS cell value (rich text, hyperlink, formula result, date) to a primitive. */
function cellToPrimitive(value: ExcelJS.CellValue): CellPrimitive {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('text' in value) return String(value.text);
    if ('result' in value) return cellToPrimitive(value.result as ExcelJS.CellValue);
    if ('error' in value) return value.error;
  }
  return String(value);
}

/** Header text per column (1-based column → key), mirroring SheetJS `__EMPTY` / `_1` naming. */
function readHeaderRow(ws: ExcelJS.Worksheet): Map<number, string> {
  const headers = new Map<number, string>();
  const seen = new Set<string>();
  let emptyCount = 0;
  const headerRow = ws.getRow(1);
  const colCount = Math.max(headerRow.cellCount, ws.columnCount);
  for (let col = 1; col <= colCount; col++) {
    const raw = cellToPrimitive(headerRow.getCell(col).value);
    let name = raw === null ? '' : String(raw).trim();
    if (!name) {
      name = emptyCount === 0 ? '__EMPTY' : `__EMPTY_${emptyCount}`;
      emptyCount++;
    }
    let unique = name;
    for (let n = 1; seen.has(unique); n++) unique = `${name}_${n}`;
    seen.add(unique);
    headers.set(col, unique);
  }
  return headers;
}

/** Keep CSV cells as text/number only (SheetJS parity); no date coercion. */
function csvCellMap(datum: unknown): CellPrimitive {
  if (datum === null || datum === undefined) return '';
  const text = String(datum);
  if (text.trim() === '') return '';
  const n = Number(text);
  return Number.isFinite(n) ? n : text;
}

function stripUtf8Bom(buffer: Buffer): Buffer {
  const hasBom =
    buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  return hasBom ? buffer.subarray(3) : buffer;
}

async function loadFirstWorksheet(
  buffer: Buffer,
  filename: string
): Promise<{ ws?: ExcelJS.Worksheet; error?: string }> {
  const lower = filename.toLowerCase();
  const wb = new ExcelJS.Workbook();

  if (lower.endsWith('.csv')) {
    try {
      // Strip a UTF-8 BOM so the first header is not prefixed with U+FEFF.
      const ws = await wb.csv.read(Readable.from([stripUtf8Bom(buffer)]), { map: csvCellMap });
      return { ws };
    } catch {
      return { error: 'Unsupported or malformed .csv file.' };
    }
  }

  if (lower.endsWith('.xlsx')) {
    try {
      await wb.xlsx.load(buffer);
    } catch {
      return { error: 'Unsupported or corrupt .xlsx file.' };
    }
    const ws = wb.worksheets[0];
    if (!ws) return { error: 'File has no data rows.' };
    return { ws };
  }

  if (lower.endsWith('.xls')) {
    return {
      error: 'Unsupported file type: legacy .xls. Save as .xlsx or .csv and upload again.',
    };
  }

  return { error: 'Unsupported file type. Upload .csv or .xlsx.' };
}

/**
 * First row = headers; later rows become objects keyed by header text ('' for empty cells).
 * Stops once `maxRows` coordinate rows have been collected instead of materialising the sheet.
 */
async function parseWorkbookRows(
  buffer: Buffer,
  filename: string,
  maxRows: number
): Promise<{
  rows: IcemanRow[];
  passThroughHeaders: string[];
  error?: string;
}> {
  const loaded = await loadFirstWorksheet(buffer, filename);
  if (loaded.error || !loaded.ws) {
    return { rows: [], passThroughHeaders: [], error: loaded.error };
  }
  const ws = loaded.ws;

  const headerByCol = readHeaderRow(ws);
  const headers = [...headerByCol.values()];
  if (!headers.length || ws.rowCount < 2) {
    return { rows: [], passThroughHeaders: [], error: 'File has no data rows.' };
  }

  const latLng = findLatLngColumns(headers);
  if (!latLng) {
    return {
      rows: [],
      passThroughHeaders: [],
      error:
        'Missing latitude/longitude columns. Expected columns named lat/lng, latitude/longitude, or similar.',
    };
  }

  const passThroughHeaders = headers.filter(
    (h) => h !== latLng.latCol && h !== latLng.lngCol
  );

  const rows: IcemanRow[] = [];
  let sawDataRow = false;
  for (let r = 2; r <= ws.rowCount && rows.length < maxRows; r++) {
    const excelRow = ws.getRow(r);
    const record: Record<string, CellPrimitive> = {};
    let hasValue = false;
    for (const [col, key] of headerByCol) {
      const v = cellToPrimitive(excelRow.getCell(col).value);
      if (v !== '') hasValue = true;
      record[key] = v;
    }
    if (!hasValue) continue;
    sawDataRow = true;

    const lat = Number(record[latLng.latCol]);
    const lng = Number(record[latLng.lngCol]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const passThrough: Record<string, string | number | boolean | null> = {};
    for (const h of passThroughHeaders) {
      const v = record[h];
      passThrough[h] = v === null || v === undefined ? null : v;
    }
    rows.push({ lat, lng, passThrough });
  }

  if (!sawDataRow) {
    return { rows: [], passThroughHeaders: [], error: 'File has no data rows.' };
  }

  if (!rows.length) {
    return {
      rows: [],
      passThroughHeaders,
      error: 'No valid coordinate rows found. Check lat/lng values are numeric.',
    };
  }

  return { rows, passThroughHeaders };
}

function coordKey(row: IcemanRow): string {
  return `${row.lat.toFixed(6)},${row.lng.toFixed(6)}`;
}

export async function generateIcemanWorkbook(
  fileBuffer: Buffer,
  filename: string,
  maxRows = DEFAULT_MAX_ROWS,
  imageOptions?: IcemanImageOptions
): Promise<{ buffer: Buffer; filename: string }> {
  const apiKey = requireNearmapKey();
  const rowCap = Math.min(Math.max(1, Math.floor(maxRows)), ICEMAN_MAX_ROWS);
  const parsed = await parseWorkbookRows(fileBuffer, filename, rowCap);
  if (parsed.error) {
    throw new Error(parsed.error);
  }

  const opts = normalizeIcemanImageOptions(imageOptions);
  const rows = parsed.rows;
  const passThroughHeaders = parsed.passThroughHeaders;

  const shots: ImageShot[] = [
    {
      key: 'topDown',
      contentType: 'Vert',
      meters: TOP_DOWN_M,
      label: `Top-Down ~${TOP_DOWN_M}m`,
    },
    {
      key: 'close',
      contentType: 'North',
      meters: opts.closeObliqueMeters,
      label: `North Oblique ~${opts.closeObliqueMeters}m`,
    },
    {
      key: 'far',
      contentType: 'North',
      meters: opts.farObliqueMeters,
      label: `North Oblique ~${opts.farObliqueMeters}m`,
    },
  ];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('ICEMAN');

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' },
  };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };

  const headers = [
    'Latitude',
    'Longitude',
    ...passThroughHeaders,
    ...shots.map((s) => s.label),
    'Status',
  ];

  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 14;
  for (let i = 0; i < passThroughHeaders.length; i++) {
    ws.getColumn(3 + i).width = 18;
  }
  const imageColStart = 3 + passThroughHeaders.length;
  for (let i = 0; i < shots.length; i++) {
    ws.getColumn(imageColStart + i).width = 24;
  }
  ws.getColumn(imageColStart + shots.length).width = 36;
  const statusCol = imageColStart + shots.length;

  // 1. Coverage: one lookup per unique coordinate, all in parallel.
  const uniqueCoords = new Map<string, IcemanRow>();
  for (const row of rows) {
    const key = coordKey(row);
    if (!uniqueCoords.has(key)) uniqueCoords.set(key, row);
  }
  const coverageByKey = new Map<string, CoverageResult>();
  await Promise.all(
    [...uniqueCoords].map(async ([key, row]) => {
      coverageByKey.set(key, await getLatestSurveyIds(row.lat, row.lng, apiKey));
    })
  );

  // 2. Tiles: ROW_CONCURRENCY rows per batch, each row's three tiles in parallel.
  type RowResult = { tiles: ImageFetchResult[]; notes: string[] };
  const results: RowResult[] = new Array(rows.length);

  const processRow = async (i: number): Promise<void> => {
    const row = rows[i];
    const coverage = coverageByKey.get(coordKey(row)) ?? { surveyIds: {} };
    const notes: string[] = [];
    if (coverage.note) notes.push(coverage.note);
    const tiles = await Promise.all(
      shots.map((shot) =>
        fetchTile(
          row.lat,
          row.lng,
          shot.meters,
          shot.label,
          shot.contentType,
          apiKey,
          coverage.surveyIds[shot.contentType]
        )
      )
    );
    results[i] = { tiles, notes };
  };

  for (let start = 0; start < rows.length; start += ROW_CONCURRENCY) {
    if (start > 0) await sleep(REQUEST_DELAY_MS);
    const batch: Promise<void>[] = [];
    for (let i = start; i < Math.min(start + ROW_CONCURRENCY, rows.length); i++) {
      batch.push(processRow(i));
    }
    await Promise.all(batch);
  }

  // 3. Write rows in original order once every fetch has settled.
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { tiles, notes } = results[i];
    const excelRowNum = i + 2;
    const statusNotes = [...notes];

    const dataCells = [
      row.lat,
      row.lng,
      ...passThroughHeaders.map((h) => row.passThrough[h] ?? ''),
      ...shots.map(() => ''),
      '',
    ];
    ws.addRow(dataCells);
    ws.getRow(excelRowNum).height = 95;

    for (let imgIdx = 0; imgIdx < shots.length; imgIdx++) {
      const result = tiles[imgIdx];
      if (result.note) statusNotes.push(result.note);
      if (!result.buffer) continue;

      const imageId = wb.addImage({
        buffer: result.buffer,
        extension: 'jpeg',
      });

      const col = imageColStart + imgIdx - 1;
      ws.addImage(imageId, {
        tl: { col, row: excelRowNum - 1 },
        ext: { width: THUMB_WIDTH, height: THUMB_HEIGHT },
      });
    }

    ws.getCell(excelRowNum, statusCol).value = statusNotes.length
      ? [...new Set(statusNotes)].join('; ')
      : 'OK';
  }

  const out = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    buffer: Buffer.from(out),
    filename: `iceman-output-${stamp}.xlsx`,
  };
}
