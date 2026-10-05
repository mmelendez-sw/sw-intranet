/**
 * ICEMAN — batch Nearmap imagery → XLSX with embedded thumbnails.
 *
 * Env: NEARMAP_API_KEY
 *
 * Output images (north oblique):
 *   - Close range: 15–50 m ground coverage (default 35 m)
 *   - Far range:   200–500 m ground coverage (default 300 m)
 */

import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import Jimp from 'jimp';

const NEARMAP_TILES_BASE = 'https://api.nearmap.com/tiles/v3';
const NEARMAP_COVERAGE_BASE = 'https://api.nearmap.com/coverage/v2';
/** Rows processed in parallel (each row = 1 coverage call + 2 tile calls). */
export const DEFAULT_CONCURRENCY = 4;
/** Retries after the first attempt for Nearmap 429 / 5xx responses. */
export const DEFAULT_MAX_RETRIES = 3;
/** Exponential backoff base: 500ms, 1s, 2s, ... */
export const DEFAULT_RETRY_BASE_DELAY_MS = 500;
/** Upper bound on any single backoff wait (including Retry-After). */
const MAX_RETRY_DELAY_MS = 10_000;
const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 120;
export const DEFAULT_MAX_ROWS = 500;

/** Approximate tile ground width (m) → Web Mercator zoom. */
const EARTH_CIRCUMFERENCE_M = 40075016.686;

export const CLOSE_OBLIQUE_MIN_M = 15;
export const CLOSE_OBLIQUE_MAX_M = 50;
export const CLOSE_OBLIQUE_DEFAULT_M = 35;

export const FAR_OBLIQUE_MIN_M = 200;
export const FAR_OBLIQUE_MAX_M = 500;
export const FAR_OBLIQUE_DEFAULT_M = 300;

export type IcemanRow = {
  lat: number;
  lng: number;
  passThrough: Record<string, string | number | boolean | null>;
};

export type IcemanImageOptions = {
  closeObliqueMeters?: number;
  farObliqueMeters?: number;
};

export type RetryOptions = {
  /** Retries after the first attempt (default 3). */
  maxRetries?: number;
  /** Backoff base in ms; attempt n waits base * 2^n unless Retry-After is set (default 500). */
  retryBaseDelayMs?: number;
  /** Injectable delay (tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Options accepted by generateIcemanWorkbook's 4th argument. A superset of
 * IcemanImageOptions so existing callers keep working unchanged.
 */
export type IcemanGenerateOptions = IcemanImageOptions &
  RetryOptions & {
    /** Max rows in flight at once (default 4). */
    concurrency?: number;
    /** Called after each row finishes fetching (processed count is 1..total). */
    onProgress?: (processed: number, total: number) => void;
  };

type ObliqueShot = {
  key: 'close' | 'far';
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
  resources?: { type?: string }[];
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Retry-After as delay ms (delta-seconds or HTTP-date), or null if absent/invalid. */
export function parseRetryAfterMs(value: string | null | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  const at = Date.parse(trimmed);
  if (Number.isFinite(at)) return Math.max(0, at - now);
  return null;
}

/**
 * fetch() with retry + exponential backoff on HTTP 429 and 5xx.
 * Returns the last response when retries are exhausted (callers inspect res.ok).
 * Network errors (fetch throwing) are not retried and propagate.
 */
export async function fetchWithRetry(url: string, opts: RetryOptions = {}): Promise<Response> {
  const maxRetries = Math.max(0, Math.floor(opts.maxRetries ?? DEFAULT_MAX_RETRIES));
  const base = Math.max(0, opts.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS);
  const wait = opts.sleep ?? sleep;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.ok || !isRetryableStatus(res.status) || attempt >= maxRetries) return res;

    const retryAfter = parseRetryAfterMs(res.headers?.get?.('retry-after'));
    const delay = Math.min(MAX_RETRY_DELAY_MS, retryAfter ?? base * 2 ** attempt);
    // Drain the body so the connection can be reused.
    await res.arrayBuffer().catch(() => undefined);
    await wait(delay);
  }
}

/**
 * Run fn over items with at most `limit` in flight. Results keep input order.
 * Items are started in index order.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const workerCount = Math.min(items.length, Math.max(1, Math.floor(limit) || 1));
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

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

export function findLatLngColumns(headers: string[]): { latCol: string; lngCol: string } | null {
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

export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

/** Ground width of one 256px Web Mercator tile at latitude / zoom. */
export function tileGroundWidthMeters(lat: number, zoom: number): number {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  return (EARTH_CIRCUMFERENCE_M * Math.max(0.01, cosLat)) / 2 ** zoom;
}

/**
 * Pick integer zoom whose tile ground width is closest to the requested meters.
 * Nearmap typically tops out around zoom 21 for high-res surveys.
 */
export function zoomForGroundCoverageMeters(lat: number, targetMeters: number): number {
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

async function getLatestSurveyId(
  lat: number,
  lng: number,
  apiKey: string,
  retry: RetryOptions = {}
): Promise<{ surveyId: string | null; note?: string }> {
  const coord = `${lng},${lat}`;
  const url = `${NEARMAP_COVERAGE_BASE}/point/${encodeURIComponent(coord)}?apikey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetchWithRetry(url, retry);
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

async function fetchNorthObliqueTile(
  lat: number,
  lng: number,
  meters: number,
  label: string,
  apiKey: string,
  surveyId: string | null,
  retry: RetryOptions = {}
): Promise<ImageFetchResult> {
  const zoom = zoomForGroundCoverageMeters(lat, meters);
  const { x, y } = latLngToTile(lat, lng, zoom);
  const contentType = 'North';

  const path = surveyId
    ? `surveys/${surveyId}/${contentType}/${zoom}/${x}/${y}.jpg`
    : `${contentType}/${zoom}/${x}/${y}.jpg`;

  const url = `${NEARMAP_TILES_BASE}/${path}?apikey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetchWithRetry(url, retry);
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
    image.cover(THUMB_WIDTH, THUMB_HEIGHT);
    const thumb = await image.getBufferAsync(Jimp.MIME_JPEG);
    return { buffer: thumb };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Tile fetch failed';
    console.error('[iceman] tile error', label, lat, lng, msg);
    return { buffer: null, note: `${label}: ${msg}` };
  }
}

export function parseWorkbookRows(buffer: Buffer, filename: string): {
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
  maxRows = DEFAULT_MAX_ROWS,
  imageOptions?: IcemanGenerateOptions
): Promise<{ buffer: Buffer; filename: string }> {
  const apiKey = requireNearmapKey();
  const parsed = parseWorkbookRows(fileBuffer, filename);
  if (parsed.error) {
    throw new Error(parsed.error);
  }

  const opts = normalizeIcemanImageOptions(imageOptions);
  const rows = parsed.rows.slice(0, maxRows);
  const passThroughHeaders = parsed.passThroughHeaders;

  const shots: ObliqueShot[] = [
    {
      key: 'close',
      meters: opts.closeObliqueMeters,
      label: `North Oblique ~${opts.closeObliqueMeters}m`,
    },
    {
      key: 'far',
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

  const retry: RetryOptions = {
    maxRetries: imageOptions?.maxRetries,
    retryBaseDelayMs: imageOptions?.retryBaseDelayMs,
    sleep: imageOptions?.sleep,
  };
  const concurrency = imageOptions?.concurrency ?? DEFAULT_CONCURRENCY;
  const onProgress = imageOptions?.onProgress;

  // Promise cache: concurrent rows with the same coordinate share one coverage call.
  // Only the row that issued the call reports its note (same as the old sequential loop,
  // where later duplicates hit the cache and added no coverage note).
  const surveyCache = new Map<string, Promise<{ surveyId: string | null; note?: string }>>();

  type RowResult = { images: (Buffer | null)[]; statusNotes: string[] };
  let processed = 0;

  const results = await mapWithConcurrency(rows, concurrency, async (row): Promise<RowResult> => {
    const statusNotes: string[] = [];
    const cacheKey = `${row.lat.toFixed(6)},${row.lng.toFixed(6)}`;

    let coveragePromise = surveyCache.get(cacheKey);
    const ownsCoverage = !coveragePromise;
    if (!coveragePromise) {
      coveragePromise = getLatestSurveyId(row.lat, row.lng, apiKey, retry);
      surveyCache.set(cacheKey, coveragePromise);
    }
    const coverage = await coveragePromise;
    if (ownsCoverage && coverage.note) statusNotes.push(coverage.note);

    const images: (Buffer | null)[] = [];
    for (const shot of shots) {
      const result = await fetchNorthObliqueTile(
        row.lat,
        row.lng,
        shot.meters,
        shot.label,
        apiKey,
        coverage.surveyId,
        retry
      );
      if (result.note) statusNotes.push(result.note);
      images.push(result.buffer);
    }

    processed++;
    if (onProgress) {
      try {
        onProgress(processed, rows.length);
      } catch (err) {
        console.error('[iceman] onProgress callback failed', err);
      }
    }
    return { images, statusNotes };
  });

  // Build the sheet sequentially in input order so layout and image ordering are deterministic.
  const statusCol = imageColStart + shots.length;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const excelRowNum = i + 2;
    const { images, statusNotes } = results[i];

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
      const buffer = images[imgIdx];
      if (!buffer) continue;

      const imageId = wb.addImage({
        buffer,
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
