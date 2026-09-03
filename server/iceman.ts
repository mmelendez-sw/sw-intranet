/**
 * ICEMAN — batch Nearmap imagery → XLSX with embedded thumbnails.
 *
 * Env: NEARMAP_API_KEY
 */

import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import Jimp from 'jimp';

const NEARMAP_TILES_BASE = 'https://api.nearmap.com/tiles/v3';
const NEARMAP_COVERAGE_BASE = 'https://api.nearmap.com/coverage/v2';
const REQUEST_DELAY_MS = 200;
const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 120;
const DEFAULT_MAX_ROWS = 500;

export type IcemanRow = {
  lat: number;
  lng: number;
  passThrough: Record<string, string | number | boolean | null>;
};

export type IcemanImageKind = 'vert250' | 'vert50' | 'north';

type ImageFetchResult = {
  buffer: Buffer | null;
  note?: string;
};

type CoverageSurvey = {
  id?: string;
  captureDate?: string;
  resources?: { type?: string }[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function requireNearmapKey(): string {
  const key = process.env.NEARMAP_API_KEY?.trim();
  if (!key) throw new Error('Missing required env var: NEARMAP_API_KEY');
  return key;
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

async function getLatestSurveyId(
  lat: number,
  lng: number,
  apiKey: string
): Promise<{ surveyId: string | null; note?: string }> {
  const coord = `${lng},${lat}`;
  const url = `${NEARMAP_COVERAGE_BASE}/point/${encodeURIComponent(coord)}?apikey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { surveyId: null, note: `Coverage ${res.status}` };
    }
    const data = (await res.json()) as { surveys?: CoverageSurvey[] };
    const surveys = Array.isArray(data.surveys) ? data.surveys : [];
    if (!surveys.length) {
      return { surveyId: null, note: 'No coverage' };
    }

    const sorted = [...surveys].sort((a, b) => {
      const da = a.captureDate ? Date.parse(a.captureDate) : 0;
      const db = b.captureDate ? Date.parse(b.captureDate) : 0;
      return db - da;
    });

    const latest = sorted.find((s) => s.id) ?? sorted[0];
    return { surveyId: latest.id ?? null, note: latest.id ? undefined : 'No survey id' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Coverage failed';
    console.error('[iceman] coverage error', lat, lng, msg);
    return { surveyId: null, note: msg };
  }
}

function tileResourceType(kind: IcemanImageKind): string {
  if (kind === 'north') return 'North';
  return 'Vert';
}

function zoomForKind(kind: IcemanImageKind): number {
  if (kind === 'vert250') return 17;
  if (kind === 'vert50') return 19;
  return 19;
}

function imageLabel(kind: IcemanImageKind): string {
  if (kind === 'vert250') return 'Vertical ~250m';
  if (kind === 'vert50') return 'Vertical ~50m';
  return 'North Oblique';
}

async function fetchNearmapTile(
  lat: number,
  lng: number,
  kind: IcemanImageKind,
  apiKey: string,
  surveyId: string | null
): Promise<ImageFetchResult> {
  const zoom = zoomForKind(kind);
  const { x, y } = latLngToTile(lat, lng, zoom);
  const contentType = tileResourceType(kind);

  const path = surveyId
    ? `surveys/${surveyId}/${contentType}/${zoom}/${x}/${y}.jpg`
    : `${contentType}/${zoom}/${x}/${y}.jpg`;

  const url = `${NEARMAP_TILES_BASE}/${path}?apikey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { buffer: null, note: `${imageLabel(kind)} ${res.status}` };
    }
    const arrayBuf = await res.arrayBuffer();
    const raw = Buffer.from(arrayBuf);
    if (!raw.length) {
      return { buffer: null, note: `${imageLabel(kind)} empty` };
    }

    const image = await Jimp.read(raw);
    image.cover(THUMB_WIDTH, THUMB_HEIGHT);
    const thumb = await image.getBufferAsync(Jimp.MIME_JPEG);
    return { buffer: thumb };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Tile fetch failed';
    console.error('[iceman] tile error', kind, lat, lng, msg);
    return { buffer: null, note: `${imageLabel(kind)}: ${msg}` };
  }
}

function parseWorkbookRows(buffer: Buffer, filename: string): {
  rows: IcemanRow[];
  passThroughHeaders: string[];
  error?: string;
} {
  const lower = filename.toLowerCase();
  let sheetRows: Record<string, unknown>[] = [];

  if (lower.endsWith('.csv')) {
    const wb = XLSX.read(buffer.toString('utf8'), { type: 'string' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  } else {
    return { rows: [], passThroughHeaders: [], error: 'Unsupported file type. Upload .csv or .xlsx.' };
  }

  if (!sheetRows.length) {
    return { rows: [], passThroughHeaders: [], error: 'File has no data rows.' };
  }

  const headers = Object.keys(sheetRows[0]);
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
  for (const raw of sheetRows) {
    const lat = Number(raw[latLng.latCol]);
    const lng = Number(raw[latLng.lngCol]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const passThrough: Record<string, string | number | boolean | null> = {};
    for (const h of passThroughHeaders) {
      const v = raw[h];
      passThrough[h] =
        v === null || v === undefined
          ? null
          : typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
            ? v
            : String(v);
    }
    rows.push({ lat, lng, passThrough });
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

export async function generateIcemanWorkbook(
  fileBuffer: Buffer,
  filename: string,
  maxRows = DEFAULT_MAX_ROWS
): Promise<{ buffer: Buffer; filename: string }> {
  const apiKey = requireNearmapKey();
  const parsed = parseWorkbookRows(fileBuffer, filename);
  if (parsed.error) {
    throw new Error(parsed.error);
  }

  const rows = parsed.rows.slice(0, maxRows);
  const passThroughHeaders = parsed.passThroughHeaders;
  const imageKinds: IcemanImageKind[] = ['vert250', 'vert50', 'north'];

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
    ...imageKinds.map(imageLabel),
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
  for (let i = 0; i < imageKinds.length; i++) {
    ws.getColumn(imageColStart + i).width = 24;
  }
  ws.getColumn(imageColStart + imageKinds.length).width = 36;

  const surveyCache = new Map<string, string | null>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const excelRowNum = i + 2;
    const statusNotes: string[] = [];

    const dataCells = [
      row.lat,
      row.lng,
      ...passThroughHeaders.map((h) => row.passThrough[h] ?? ''),
      '',
      '',
      '',
      '',
    ];
    ws.addRow(dataCells);
    ws.getRow(excelRowNum).height = 95;

    const cacheKey = `${row.lat.toFixed(6)},${row.lng.toFixed(6)}`;
    let surveyId = surveyCache.get(cacheKey);
    if (surveyId === undefined) {
      const coverage = await getLatestSurveyId(row.lat, row.lng, apiKey);
      surveyId = coverage.surveyId;
      surveyCache.set(cacheKey, surveyId);
      if (coverage.note) statusNotes.push(coverage.note);
      await sleep(REQUEST_DELAY_MS);
    }

    for (let imgIdx = 0; imgIdx < imageKinds.length; imgIdx++) {
      const kind = imageKinds[imgIdx];
      const result = await fetchNearmapTile(row.lat, row.lng, kind, apiKey, surveyId);
      await sleep(REQUEST_DELAY_MS);

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

    const statusCol = imageColStart + imageKinds.length;
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
