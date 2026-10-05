import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import Jimp from 'jimp';
import {
  findLatLngColumns,
  latLngToTile,
  tileGroundWidthMeters,
  zoomForGroundCoverageMeters,
  normalizeIcemanImageOptions,
  parseWorkbookRows,
  parseRetryAfterMs,
  fetchWithRetry,
  mapWithConcurrency,
  generateIcemanWorkbook,
  CLOSE_OBLIQUE_DEFAULT_M,
  FAR_OBLIQUE_DEFAULT_M,
} from '../iceman';

const noSleep = vi.fn(async (_ms: number) => {});

let jpeg: Buffer;
beforeAll(async () => {
  const img = new Jimp(256, 192, 0x3366ccff);
  jpeg = await img.getBufferAsync(Jimp.MIME_JPEG);
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  noSleep.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function csv(text: string): Buffer {
  return Buffer.from(text, 'utf8');
}

function xlsxBuffer(rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('findLatLngColumns', () => {
  it.each([
    [['lat', 'lng'], 'lat', 'lng'],
    [['Latitude', 'Longitude'], 'Latitude', 'Longitude'],
    [['LAT', 'LON'], 'LAT', 'LON'],
    [[' Lat ', 'Long'], ' Lat ', 'Long'],
    [['Y', 'X'], 'Y', 'X'],
    [['Lati_tude', 'Longi tude'], 'Lati_tude', 'Longi tude'],
    [['lat-itude', 'long-itude'], 'lat-itude', 'long-itude'],
  ])('detects %j', (headers, latCol, lngCol) => {
    expect(findLatLngColumns(headers)).toEqual({ latCol, lngCol });
  });

  it('picks the first matching header for each', () => {
    expect(findLatLngColumns(['Site', 'lat', 'latitude', 'lng', 'x'])).toEqual({
      latCol: 'lat',
      lngCol: 'lng',
    });
  });

  it('returns null when either column is missing', () => {
    expect(findLatLngColumns(['lat', 'name'])).toBeNull();
    expect(findLatLngColumns(['longitude'])).toBeNull();
    expect(findLatLngColumns([])).toBeNull();
    expect(findLatLngColumns(['latitudes', 'lngs'])).toBeNull();
  });
});

describe('tile math', () => {
  it('latLngToTile matches known slippy-map tiles', () => {
    expect(latLngToTile(0, 0, 1)).toEqual({ x: 1, y: 1 });
    expect(latLngToTile(40.7128, -74.006, 10)).toEqual({ x: 301, y: 385 });
    expect(latLngToTile(51.5074, -0.1278, 15)).toEqual({ x: 16372, y: 10896 });
  });

  it('tileGroundWidthMeters halves per zoom level and shrinks with latitude', () => {
    expect(tileGroundWidthMeters(0, 0)).toBeCloseTo(40075016.686, 3);
    expect(tileGroundWidthMeters(0, 20)).toBeCloseTo(38.218, 2);
    expect(tileGroundWidthMeters(0, 19) / tileGroundWidthMeters(0, 20)).toBeCloseTo(2, 10);
    expect(tileGroundWidthMeters(60, 20)).toBeCloseTo(tileGroundWidthMeters(0, 20) / 2, 6);
  });

  it('tileGroundWidthMeters floors cos(lat) at 0.01 near the poles', () => {
    expect(tileGroundWidthMeters(90, 0)).toBeCloseTo(40075016.686 * 0.01, 3);
  });

  it('zoomForGroundCoverageMeters picks closest zoom for 35 m and 300 m', () => {
    expect(zoomForGroundCoverageMeters(0, 35)).toBe(20);
    expect(zoomForGroundCoverageMeters(0, 300)).toBe(17);
    expect(zoomForGroundCoverageMeters(40.7, 35)).toBe(20);
    expect(zoomForGroundCoverageMeters(40.7, 300)).toBe(17);
  });

  it('zoomForGroundCoverageMeters clamps to 14..21', () => {
    expect(zoomForGroundCoverageMeters(0, 1)).toBe(21);
    expect(zoomForGroundCoverageMeters(0, -50)).toBe(21);
    expect(zoomForGroundCoverageMeters(0, 10_000_000)).toBe(14);
  });
});

describe('normalizeIcemanImageOptions', () => {
  it('defaults when missing', () => {
    expect(normalizeIcemanImageOptions()).toEqual({
      closeObliqueMeters: CLOSE_OBLIQUE_DEFAULT_M,
      farObliqueMeters: FAR_OBLIQUE_DEFAULT_M,
    });
    expect(normalizeIcemanImageOptions({})).toEqual({
      closeObliqueMeters: 35,
      farObliqueMeters: 300,
    });
  });

  it('defaults on NaN / Infinity', () => {
    expect(
      normalizeIcemanImageOptions({ closeObliqueMeters: NaN, farObliqueMeters: Infinity })
    ).toEqual({ closeObliqueMeters: 35, farObliqueMeters: 300 });
  });

  it('clamps to range and rounds', () => {
    expect(
      normalizeIcemanImageOptions({ closeObliqueMeters: 1, farObliqueMeters: 9999 })
    ).toEqual({ closeObliqueMeters: 15, farObliqueMeters: 500 });
    expect(
      normalizeIcemanImageOptions({ closeObliqueMeters: 99, farObliqueMeters: 10 })
    ).toEqual({ closeObliqueMeters: 50, farObliqueMeters: 200 });
    expect(
      normalizeIcemanImageOptions({ closeObliqueMeters: 22.6, farObliqueMeters: 250.4 })
    ).toEqual({ closeObliqueMeters: 23, farObliqueMeters: 250 });
  });

  it('accepts numeric strings (coerced via Number)', () => {
    expect(
      normalizeIcemanImageOptions({
        closeObliqueMeters: '40' as unknown as number,
        farObliqueMeters: '400' as unknown as number,
      })
    ).toEqual({ closeObliqueMeters: 40, farObliqueMeters: 400 });
  });
});

describe('parseWorkbookRows', () => {
  it('parses CSV with pass-through columns', () => {
    const out = parseWorkbookRows(
      csv('Site,Latitude,Longitude,Notes\nA,40.1,-74.2,first\nB,41.5,-73.9,second\n'),
      'sites.CSV'
    );
    expect(out.error).toBeUndefined();
    expect(out.passThroughHeaders).toEqual(['Site', 'Notes']);
    expect(out.rows).toEqual([
      { lat: 40.1, lng: -74.2, passThrough: { Site: 'A', Notes: 'first' } },
      { lat: 41.5, lng: -73.9, passThrough: { Site: 'B', Notes: 'second' } },
    ]);
  });

  it('parses XLSX and preserves number / boolean / empty cells', () => {
    const buf = xlsxBuffer([
      ['lat', 'lng', 'Count', 'Active', 'Blank'],
      [40, -74, 5, true, ''],
      [41, -75, 7, false, null],
    ]);
    const out = parseWorkbookRows(buf, 'input.xlsx');
    expect(out.error).toBeUndefined();
    expect(out.passThroughHeaders).toEqual(['Count', 'Active', 'Blank']);
    expect(out.rows[0]).toEqual({ lat: 40, lng: -74, passThrough: { Count: 5, Active: true, Blank: '' } });
    expect(out.rows[1].passThrough).toEqual({ Count: 7, Active: false, Blank: '' });
  });

  it('skips rows with non-numeric coordinates', () => {
    const out = parseWorkbookRows(
      csv('lat,lng,name\n40,-74,ok\nabc,-74,bad\nN/A,-74,na\n42,-75,ok2\n'),
      'x.csv'
    );
    expect(out.rows.map((r) => r.passThrough.name)).toEqual(['ok', 'ok2']);
  });

  // KNOWN ISSUE (reported, not fixed): a blank lat/lng cell becomes '' via defval,
  // and Number('') === 0, so the row is kept at coordinate 0 instead of skipped.
  it('currently keeps rows with a blank coordinate cell as 0 (known issue)', () => {
    const out = parseWorkbookRows(csv('lat,lng,name\n41,,blank-lng\n'), 'x.csv');
    expect(out.rows).toEqual([{ lat: 41, lng: 0, passThrough: { name: 'blank-lng' } }]);
  });

  it('treats numeric-string coordinates as numbers', () => {
    const out = parseWorkbookRows(csv('lat,lng\n" 40.5 ",-74\n'), 'x.csv');
    expect(out.rows).toEqual([{ lat: 40.5, lng: -74, passThrough: {} }]);
  });

  it('rejects unsupported extensions', () => {
    expect(parseWorkbookRows(csv('lat,lng\n1,2'), 'x.txt').error).toBe(
      'Unsupported file type. Upload .csv or .xlsx.'
    );
  });

  it('errors on header-only file', () => {
    expect(parseWorkbookRows(csv('lat,lng\n'), 'x.csv').error).toBe('File has no data rows.');
  });

  it('errors on missing lat/lng columns', () => {
    expect(parseWorkbookRows(csv('a,b\n1,2\n'), 'x.csv').error).toMatch(
      /^Missing latitude\/longitude columns/
    );
  });

  it('errors when no row has valid coordinates', () => {
    const out = parseWorkbookRows(csv('lat,lng,name\nx,y,z\n'), 'x.csv');
    expect(out.error).toBe('No valid coordinate rows found. Check lat/lng values are numeric.');
    expect(out.passThroughHeaders).toEqual(['name']);
  });
});

describe('parseRetryAfterMs', () => {
  it('parses delta-seconds and HTTP dates', () => {
    expect(parseRetryAfterMs('2')).toBe(2000);
    expect(parseRetryAfterMs('0.5')).toBe(500);
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(parseRetryAfterMs('Thu, 01 Jan 2026 00:00:03 GMT', now)).toBe(3000);
    expect(parseRetryAfterMs('Wed, 31 Dec 2025 00:00:00 GMT', now)).toBe(0);
  });

  it('returns null for missing / garbage', () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs(undefined)).toBeNull();
    expect(parseRetryAfterMs('')).toBeNull();
    expect(parseRetryAfterMs('soon')).toBeNull();
  });
});

describe('fetchWithRetry', () => {
  it('retries 429/5xx with exponential backoff then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await fetchWithRetry('https://x', { sleep: noSleep, retryBaseDelayMs: 100 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(noSleep.mock.calls.map((c) => c[0])).toEqual([100, 200]);
  });

  it('honors Retry-After (capped at 10s)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '3' } }))
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '120' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchWithRetry('https://x', { sleep: noSleep });
    expect(noSleep.mock.calls.map((c) => c[0])).toEqual([3000, 10_000]);
  });

  it('gives up after maxRetries and returns the last response', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await fetchWithRetry('https://x', { sleep: noSleep, maxRetries: 2 });
    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(noSleep.mock.calls.map((c) => c[0])).toEqual([500, 1000]);
  });

  it('does not retry 4xx other than 429', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await fetchWithRetry('https://x', { sleep: noSleep });
    expect(res.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(noSleep).not.toHaveBeenCalled();
  });

  it('propagates network errors without retrying', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchWithRetry('https://x', { sleep: noSleep })).rejects.toThrow('ECONNRESET');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('mapWithConcurrency', () => {
  it('preserves order and caps in-flight work', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const out = await mapWithConcurrency([5, 1, 4, 2, 3, 0, 6], 3, async (n, i) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, n));
      inFlight--;
      return `${i}:${n}`;
    });
    expect(out).toEqual(['0:5', '1:1', '2:4', '3:2', '4:3', '5:0', '6:6']);
    expect(maxInFlight).toBe(3);
  });

  it('handles empty input and invalid limits', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 0, async (n) => n * 2)).toEqual([2, 4]);
    expect(await mapWithConcurrency([1, 2], NaN, async (n) => n * 2)).toEqual([2, 4]);
  });
});

// ── generateIcemanWorkbook end-to-end ────────────────────────────────────────

type Route = (url: URL) => Response | Promise<Response>;

function installNearmapFetch(opts: {
  coverage?: Route;
  tile?: Route;
  delayMs?: number;
} = {}) {
  const stats = { coverageCalls: [] as string[], tileCalls: [] as string[], inFlight: 0, maxInFlight: 0 };
  const coverage: Route =
    opts.coverage ??
    (() =>
      Response.json({
        surveys: [
          { id: 'old', captureDate: '2020-01-01' },
          { id: 'new', captureDate: '2024-06-01' },
        ],
      }));
  const tile: Route = opts.tile ?? (() => new Response(jpeg, { status: 200 }));

  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    stats.inFlight++;
    stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
    try {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (url.pathname.startsWith('/coverage/')) {
        stats.coverageCalls.push(url.pathname);
        return await coverage(url);
      }
      stats.tileCalls.push(url.pathname);
      return await tile(url);
    } finally {
      stats.inFlight--;
    }
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, stats };
}

async function loadOutput(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.getWorksheet('ICEMAN')!;
  const rows: unknown[][] = [];
  ws.eachRow((row) => {
    rows.push((row.values as unknown[]).slice(1));
  });
  const images = ws
    .getImages()
    .map((img) => ({ col: img.range.tl.nativeCol, row: img.range.tl.nativeRow }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
  return { ws, rows, images };
}

describe('generateIcemanWorkbook', () => {
  beforeEach(() => {
    vi.stubEnv('NEARMAP_API_KEY', 'test-key');
  });

  it('throws when NEARMAP_API_KEY is missing or blank', async () => {
    vi.stubEnv('NEARMAP_API_KEY', '   ');
    await expect(generateIcemanWorkbook(csv('lat,lng\n1,2\n'), 'x.csv')).rejects.toThrow(
      'Missing required env var: NEARMAP_API_KEY'
    );
  });

  it('throws parse errors as Error messages', async () => {
    installNearmapFetch();
    await expect(generateIcemanWorkbook(csv('a,b\n1,2\n'), 'x.csv')).rejects.toThrow(
      /Missing latitude\/longitude/
    );
  });

  it('builds rows in input order with headers, images and OK status', async () => {
    const { stats } = installNearmapFetch({ delayMs: 1 });
    const input = csv('Site,lat,lng\nA,40.1,-74.1\nB,40.2,-74.2\nC,40.3,-74.3\n');
    const { buffer, filename } = await generateIcemanWorkbook(input, 'x.csv', undefined, {
      sleep: noSleep,
    });
    expect(filename).toMatch(/^iceman-output-\d{4}-\d{2}-\d{2}\.xlsx$/);

    const { rows, images, ws } = await loadOutput(buffer);
    expect(rows[0]).toEqual([
      'Latitude',
      'Longitude',
      'Site',
      'North Oblique ~35m',
      'North Oblique ~300m',
      'Status',
    ]);
    expect(rows.slice(1).map((r) => [r[0], r[1], r[2], r[5]])).toEqual([
      [40.1, -74.1, 'A', 'OK'],
      [40.2, -74.2, 'B', 'OK'],
      [40.3, -74.3, 'C', 'OK'],
    ]);
    // Image columns (0-based nativeCol 3 and 4) on each data row (0-based nativeRow 1..3).
    expect(images).toEqual([
      { col: 3, row: 1 },
      { col: 4, row: 1 },
      { col: 3, row: 2 },
      { col: 4, row: 2 },
      { col: 3, row: 3 },
      { col: 4, row: 3 },
    ]);
    expect(ws.getRow(2).height).toBe(95);
    expect(ws.getColumn(6).width).toBe(36);

    // Uses the newest survey and zooms 20 (35m) / 17 (300m).
    expect(stats.tileCalls).toHaveLength(6);
    expect(stats.tileCalls.every((p) => p.includes('/surveys/new/North/'))).toBe(true);
    expect(stats.tileCalls.filter((p) => p.includes('/North/20/'))).toHaveLength(3);
    expect(stats.tileCalls.filter((p) => p.includes('/North/17/'))).toHaveLength(3);
    expect(noSleep).not.toHaveBeenCalled();
  });

  it('respects maxRows and image meter options in labels', async () => {
    installNearmapFetch();
    const { buffer } = await generateIcemanWorkbook(
      csv('lat,lng\n1,1\n2,2\n3,3\n'),
      'x.csv',
      2,
      { closeObliqueMeters: 20, farObliqueMeters: 450, sleep: noSleep }
    );
    const { rows } = await loadOutput(buffer);
    expect(rows[0]).toEqual(['Latitude', 'Longitude', 'North Oblique ~20m', 'North Oblique ~450m', 'Status']);
    expect(rows).toHaveLength(3);
  });

  it('caps concurrency at the default of 4 rows in flight', async () => {
    const { stats } = installNearmapFetch({ delayMs: 5 });
    const lines = Array.from({ length: 12 }, (_, i) => `${40 + i * 0.01},${-74 - i * 0.01}`);
    await generateIcemanWorkbook(csv(`lat,lng\n${lines.join('\n')}\n`), 'x.csv', undefined, {
      sleep: noSleep,
    });
    expect(stats.maxInFlight).toBe(4);
    expect(stats.coverageCalls).toHaveLength(12);
    expect(stats.tileCalls).toHaveLength(24);
  });

  it('honors a custom concurrency', async () => {
    const { stats } = installNearmapFetch({ delayMs: 5 });
    const lines = Array.from({ length: 6 }, (_, i) => `${40 + i * 0.01},-74`);
    await generateIcemanWorkbook(csv(`lat,lng\n${lines.join('\n')}\n`), 'x.csv', undefined, {
      concurrency: 2,
      sleep: noSleep,
    });
    expect(stats.maxInFlight).toBe(2);
  });

  it('dedupes coverage calls for repeated coordinates even when concurrent', async () => {
    const { stats } = installNearmapFetch({
      delayMs: 5,
      coverage: () => Response.json({ surveys: [] }),
    });
    const input = csv('lat,lng,n\n40,-74,a\n40.0000001,-74,b\n41,-75,c\n40,-74,d\n');
    const { buffer } = await generateIcemanWorkbook(input, 'x.csv', undefined, { sleep: noSleep });
    expect(stats.coverageCalls).toHaveLength(2);

    // Only the row that issued the coverage call reports its note (legacy semantics).
    const { rows } = await loadOutput(buffer);
    expect(rows.slice(1).map((r) => [r[2], r[5]])).toEqual([
      ['a', 'No coverage'],
      ['b', 'OK'],
      ['c', 'No coverage'],
      ['d', 'OK'],
    ]);
    // No survey id → non-survey tile path.
    expect(stats.tileCalls.every((p) => /^\/tiles\/v3\/North\//.test(p))).toBe(true);
  });

  it('retries a 429 tile then succeeds with no status note', async () => {
    let tileHits = 0;
    const { stats } = installNearmapFetch({
      tile: () => {
        tileHits++;
        if (tileHits === 1) return new Response('', { status: 429, headers: { 'Retry-After': '1' } });
        return new Response(jpeg, { status: 200 });
      },
    });
    const { buffer } = await generateIcemanWorkbook(csv('lat,lng\n40,-74\n'), 'x.csv', undefined, {
      sleep: noSleep,
    });
    const { rows, images } = await loadOutput(buffer);
    expect(rows[1][4]).toBe('OK');
    expect(images).toHaveLength(2);
    expect(stats.tileCalls).toHaveLength(3);
    expect(noSleep).toHaveBeenCalledWith(1000);
  });

  it('gives up after retries and records status notes', async () => {
    const { stats } = installNearmapFetch({
      coverage: () => new Response('', { status: 502 }),
      tile: (url) =>
        url.pathname.includes('/North/20/')
          ? new Response('', { status: 503 })
          : new Response(jpeg, { status: 200 }),
    });
    const { buffer } = await generateIcemanWorkbook(csv('lat,lng\n40,-74\n'), 'x.csv', undefined, {
      sleep: noSleep,
      maxRetries: 2,
    });
    const { rows, images } = await loadOutput(buffer);
    expect(rows[1][4]).toBe('Coverage 502; North Oblique ~35m 503');
    expect(images).toEqual([{ col: 3, row: 1 }]);
    expect(stats.coverageCalls).toHaveLength(3);
    expect(stats.tileCalls).toHaveLength(4); // 3 for the failing close shot + 1 far
  });

  it('reports empty / undecodable tiles and thrown fetch errors in Status', async () => {
    installNearmapFetch({
      coverage: () => {
        throw new Error('socket hang up');
      },
      tile: (url) =>
        url.pathname.includes('/North/20/')
          ? new Response(new Uint8Array(0), { status: 200 })
          : new Response('not a jpeg', { status: 200 }),
    });
    const { buffer } = await generateIcemanWorkbook(csv('lat,lng\n40,-74\n'), 'x.csv', undefined, {
      sleep: noSleep,
    });
    const { rows, images } = await loadOutput(buffer);
    const status = String(rows[1][4]);
    expect(status.startsWith('socket hang up; North Oblique ~35m empty; North Oblique ~300m: ')).toBe(true);
    expect(images).toHaveLength(0);
  });

  it('calls onProgress once per row with (processed, total)', async () => {
    installNearmapFetch({ delayMs: 1 });
    const onProgress = vi.fn();
    await generateIcemanWorkbook(csv('lat,lng\n1,1\n2,2\n3,3\n'), 'x.csv', undefined, {
      sleep: noSleep,
      onProgress,
    });
    expect(onProgress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('survives an onProgress callback that throws', async () => {
    installNearmapFetch();
    const { buffer } = await generateIcemanWorkbook(csv('lat,lng\n1,1\n'), 'x.csv', undefined, {
      sleep: noSleep,
      onProgress: () => {
        throw new Error('boom');
      },
    });
    const { rows } = await loadOutput(buffer);
    expect(rows[1][4]).toBe('OK');
  });

  it('remains callable with the legacy 2-4 argument signature', async () => {
    installNearmapFetch();
    const { buffer } = await generateIcemanWorkbook(csv('lat,lng\n1,1\n'), 'x.csv');
    const { rows } = await loadOutput(buffer);
    expect(rows).toHaveLength(2);
    const r2 = await generateIcemanWorkbook(csv('lat,lng\n1,1\n'), 'x.csv', 10, {
      closeObliqueMeters: 40,
    });
    expect((await loadOutput(r2.buffer)).rows[0][2]).toBe('North Oblique ~40m');
  });

  it('sends the API key on every Nearmap request', async () => {
    const { fetchMock } = installNearmapFetch();
    await generateIcemanWorkbook(csv('lat,lng\n1,1\n'), 'x.csv', undefined, { sleep: noSleep });
    for (const [input] of fetchMock.mock.calls) {
      expect(new URL(String(input)).searchParams.get('apikey')).toBe('test-key');
    }
    expect(String(fetchMock.mock.calls[0][0])).toContain('/coverage/v2/point/1%2C1');
  });
});
