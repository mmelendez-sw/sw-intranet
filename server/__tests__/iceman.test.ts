import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import Jimp from 'jimp';
import {
  normalizeIcemanImageOptions,
  generateIcemanWorkbook,
  ICEMAN_MAX_ROWS,
  CLOSE_OBLIQUE_DEFAULT_M,
  CLOSE_OBLIQUE_MIN_M,
  CLOSE_OBLIQUE_MAX_M,
  FAR_OBLIQUE_DEFAULT_M,
  FAR_OBLIQUE_MIN_M,
  FAR_OBLIQUE_MAX_M,
  TOP_DOWN_M,
} from '../iceman';

let jpeg: Buffer;
beforeAll(async () => {
  const img = new Jimp(256, 256, 0x3366ccff);
  jpeg = await img.getBufferAsync(Jimp.MIME_JPEG);
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function csv(text: string): Buffer {
  return Buffer.from(text, 'utf8');
}

async function xlsxBuffer(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  for (const row of rows) ws.addRow(row);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('normalizeIcemanImageOptions', () => {
  it('defaults when missing', () => {
    const defaults = { closeObliqueMeters: CLOSE_OBLIQUE_DEFAULT_M, farObliqueMeters: FAR_OBLIQUE_DEFAULT_M };
    expect(normalizeIcemanImageOptions()).toEqual(defaults);
    expect(normalizeIcemanImageOptions({})).toEqual(defaults);
    expect(defaults).toEqual({ closeObliqueMeters: 45, farObliqueMeters: 375 });
  });

  it('defaults on NaN / Infinity', () => {
    expect(normalizeIcemanImageOptions({ closeObliqueMeters: NaN, farObliqueMeters: Infinity })).toEqual({
      closeObliqueMeters: CLOSE_OBLIQUE_DEFAULT_M,
      farObliqueMeters: FAR_OBLIQUE_DEFAULT_M,
    });
  });

  it('clamps to range and rounds', () => {
    expect(normalizeIcemanImageOptions({ closeObliqueMeters: 1, farObliqueMeters: 9999 })).toEqual({
      closeObliqueMeters: CLOSE_OBLIQUE_MIN_M,
      farObliqueMeters: FAR_OBLIQUE_MAX_M,
    });
    expect(normalizeIcemanImageOptions({ closeObliqueMeters: 99, farObliqueMeters: 10 })).toEqual({
      closeObliqueMeters: CLOSE_OBLIQUE_MAX_M,
      farObliqueMeters: FAR_OBLIQUE_MIN_M,
    });
    expect(normalizeIcemanImageOptions({ closeObliqueMeters: 22.6, farObliqueMeters: 250.4 })).toEqual({
      closeObliqueMeters: 23,
      farObliqueMeters: 250,
    });
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

// ── generateIcemanWorkbook end-to-end (Nearmap mocked) ───────────────────────

type Route = (url: URL) => Response | Promise<Response>;

const defaultCoverage: Route = () =>
  Response.json({
    surveys: [
      { id: 'old', captureDate: '2020-01-01', resources: { tiles: [{ type: 'Vert' }, { type: 'North' }] } },
      { id: 'new', captureDate: '2024-06-01', resources: { tiles: [{ type: 'Vert' }] } },
    ],
  });

function installNearmapFetch(opts: { coverage?: Route; tile?: Route } = {}) {
  const stats = { coverageCalls: [] as string[], tileCalls: [] as string[] };
  const coverage = opts.coverage ?? defaultCoverage;
  const tile: Route = opts.tile ?? (() => new Response(jpeg, { status: 200 }));

  const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.startsWith('/coverage/')) {
      stats.coverageCalls.push(url.pathname);
      return coverage(url);
    }
    stats.tileCalls.push(url.pathname);
    return tile(url);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, stats };
}

/** Every tile fails fast, so row-heavy tests skip JPEG decoding. */
const noTiles: Route = () => new Response('', { status: 404 });

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

const statusOf = (rows: unknown[][], dataRow: number) => {
  const r = rows[dataRow];
  return r[r.length - 1];
};

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

  describe('input parsing errors', () => {
    beforeEach(() => {
      installNearmapFetch();
    });

    it.each([
      ['x.txt', csv('lat,lng\n1,2'), 'Unsupported file type. Upload .csv or .xlsx.'],
      ['x.xls', csv('lat,lng\n1,2'), 'Unsupported file type: legacy .xls. Save as .xlsx or .csv and upload again.'],
      ['x.xlsx', csv('not a zip'), 'Unsupported or corrupt .xlsx file.'],
      ['x.csv', csv('lat,lng\n'), 'File has no data rows.'],
      ['x.csv', csv('lat,lng\n,\n'), 'File has no data rows.'],
      ['x.csv', csv('lat,lng,name\nx,y,z\n'), 'No valid coordinate rows found. Check lat/lng values are numeric.'],
    ])('%s → %s', async (name, buf, message) => {
      await expect(generateIcemanWorkbook(buf, name)).rejects.toThrow(message);
    });

    it('requires recognisable lat/lng headers', async () => {
      await expect(generateIcemanWorkbook(csv('a,b\n1,2\n'), 'x.csv')).rejects.toThrow(
        /^Missing latitude\/longitude columns/
      );
      await expect(generateIcemanWorkbook(csv('latitudes,lngs\n1,2\n'), 'x.csv')).rejects.toThrow(
        /^Missing latitude\/longitude columns/
      );
    });
  });

  it.each([
    ['lat,lng'],
    ['Latitude,Longitude'],
    ['LAT,LON'],
    [' Lat ,Long'],
    ['Y,X'],
    ['Lati_tude,Longi tude'],
    ['lat-itude,long-itude'],
  ])('detects coordinate headers %s', async (header) => {
    installNearmapFetch({ tile: noTiles });
    const { rowCount } = await generateIcemanWorkbook(csv(`${header}\n40,-74\n`), 'x.csv');
    expect(rowCount).toBe(1);
  });

  it('builds rows in input order with headers, three images and OK status', async () => {
    const { stats } = installNearmapFetch();
    const input = csv('Site,lat,lng\nA,40.1,-74.1\nB,40.2,-74.2\n');
    const { buffer, filename, rowCount } = await generateIcemanWorkbook(input, 'x.CSV');
    expect(filename).toMatch(/^iceman-output-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(rowCount).toBe(2);

    const { rows, images, ws } = await loadOutput(buffer);
    expect(rows[0]).toEqual([
      'Latitude',
      'Longitude',
      'Site',
      `Top-Down ~${TOP_DOWN_M}m`,
      'North Oblique ~45m',
      'North Oblique ~375m',
      'Status',
    ]);
    expect(rows.slice(1).map((r) => [r[0], r[1], r[2], r[6]])).toEqual([
      [40.1, -74.1, 'A', 'OK'],
      [40.2, -74.2, 'B', 'OK'],
    ]);
    // Image columns (0-based nativeCol 3..5) on each data row (0-based nativeRow 1..2).
    expect(images).toEqual([
      { col: 3, row: 1 },
      { col: 4, row: 1 },
      { col: 5, row: 1 },
      { col: 3, row: 2 },
      { col: 4, row: 2 },
      { col: 5, row: 2 },
    ]);
    expect(ws.getRow(2).height).toBe(185);
    expect(ws.getColumn(7).width).toBe(36);

    // Newest survey per tile type: verticals from "new", obliques only exist in "old".
    expect(stats.coverageCalls).toHaveLength(2);
    expect(stats.tileCalls.some((p) => p.includes('/surveys/new/Vert/'))).toBe(true);
    expect(stats.tileCalls.some((p) => p.includes('/surveys/old/North/'))).toBe(true);
    expect(stats.tileCalls.some((p) => p.includes('/surveys/old/Vert/'))).toBe(false);
    expect(stats.tileCalls.some((p) => p.includes('/surveys/new/North/'))).toBe(false);
  });

  it('embeds 4:3 JPEG thumbnails at least 240px wide', async () => {
    installNearmapFetch();
    const { buffer } = await generateIcemanWorkbook(csv('lat,lng\n40,-74\n'), 'x.csv');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('ICEMAN')!;
    const imgs = ws.getImages();
    expect(imgs).toHaveLength(3);
    for (const { imageId } of imgs) {
      const media = wb.getImage(Number(imageId));
      expect(media.extension).toBe('jpeg');
      const decoded = await Jimp.read(media.buffer as Buffer);
      expect(decoded.bitmap.width).toBeGreaterThanOrEqual(240);
      expect(decoded.bitmap.width / decoded.bitmap.height).toBeCloseTo(4 / 3, 1);
    }
  });

  it('reads .xlsx input with pass-through number / boolean / blank cells', async () => {
    installNearmapFetch({ tile: noTiles });
    const buf = await xlsxBuffer([
      ['lat', 'lng', 'Count', 'Active', 'Note'],
      [40, -74, 5, true, 'x'],
      [41, -75, 7, false, null],
    ]);
    const { buffer, rowCount } = await generateIcemanWorkbook(buf, 'input.xlsx');
    expect(rowCount).toBe(2);
    const { rows } = await loadOutput(buffer);
    expect(rows[0].slice(0, 5)).toEqual(['Latitude', 'Longitude', 'Count', 'Active', 'Note']);
    expect(rows[1].slice(0, 5)).toEqual([40, -74, 5, true, 'x']);
    expect(rows[2].slice(0, 4)).toEqual([41, -75, 7, false]);
  });

  it('strips a UTF-8 BOM, trims numeric strings and skips non-numeric coordinate rows', async () => {
    installNearmapFetch({ tile: noTiles });
    const input = csv('﻿lat,lng,name\n" 40.5 ",-74,ok\nabc,-74,bad\nN/A,-74,na\n42,-75,ok2\n');
    const { buffer, rowCount } = await generateIcemanWorkbook(input, 'x.csv');
    expect(rowCount).toBe(2);
    const { rows } = await loadOutput(buffer);
    expect(rows.slice(1).map((r) => [r[0], r[1], r[2]])).toEqual([
      [40.5, -74, 'ok'],
      [42, -75, 'ok2'],
    ]);
  });

  // KNOWN ISSUE (reported, not fixed): a blank lat/lng cell parses as '' and Number('') === 0,
  // so the row is kept at coordinate 0 instead of being skipped.
  it('currently keeps a row with a blank coordinate cell as 0 (known issue)', async () => {
    installNearmapFetch({ tile: noTiles });
    const { buffer, rowCount } = await generateIcemanWorkbook(csv('lat,lng,name\n41,,blank-lng\n'), 'x.csv');
    expect(rowCount).toBe(1);
    const { rows } = await loadOutput(buffer);
    expect(rows[1].slice(0, 3)).toEqual([41, 0, 'blank-lng']);
  });

  it(`caps rows at ICEMAN_MAX_ROWS (${ICEMAN_MAX_ROWS}) and honours a smaller maxRows`, async () => {
    const { stats } = installNearmapFetch({ tile: noTiles });
    const lines = Array.from({ length: 20 }, (_, i) => `${40 + i * 0.01},-74`);
    const input = csv(`lat,lng\n${lines.join('\n')}\n`);
    expect((await generateIcemanWorkbook(input, 'x.csv', 100)).rowCount).toBe(ICEMAN_MAX_ROWS);
    expect(stats.coverageCalls).toHaveLength(ICEMAN_MAX_ROWS);
    expect((await generateIcemanWorkbook(input, 'x.csv', 2)).rowCount).toBe(2);
    expect((await generateIcemanWorkbook(input, 'x.csv', 0)).rowCount).toBe(1);
  });

  it('uses image meter options (clamped) in the column labels', async () => {
    installNearmapFetch({ tile: noTiles });
    const { buffer } = await generateIcemanWorkbook(csv('lat,lng\n1,1\n'), 'x.csv', undefined, {
      closeObliqueMeters: 20,
      farObliqueMeters: 9999,
    });
    const { rows } = await loadOutput(buffer);
    expect(rows[0]).toEqual([
      'Latitude',
      'Longitude',
      `Top-Down ~${TOP_DOWN_M}m`,
      'North Oblique ~20m',
      `North Oblique ~${FAR_OBLIQUE_MAX_M}m`,
      'Status',
    ]);
  });

  it('looks up coverage once per unique coordinate and shares its note', async () => {
    const { stats } = installNearmapFetch({
      coverage: () => Response.json({ surveys: [] }),
      tile: noTiles,
    });
    const input = csv('lat,lng,n\n40,-74,a\n40.0000001,-74,b\n41,-75,c\n40,-74,d\n');
    const { buffer } = await generateIcemanWorkbook(input, 'x.csv');
    expect(stats.coverageCalls).toHaveLength(2);

    const { rows } = await loadOutput(buffer);
    for (let i = 1; i <= 4; i++) expect(String(statusOf(rows, i))).toMatch(/^No coverage; /);
    // No survey id → non-survey tile paths.
    expect(stats.tileCalls.every((p) => /^\/tiles\/v3\/(Vert|North)\//.test(p))).toBe(true);
  });

  it('records coverage and tile HTTP failures in Status and keeps the images that worked', async () => {
    installNearmapFetch({
      coverage: () => new Response('', { status: 502 }),
      tile: (url) =>
        url.pathname.includes('/North/') ? new Response('', { status: 503 }) : new Response(jpeg, { status: 200 }),
    });
    const { buffer } = await generateIcemanWorkbook(csv('lat,lng\n40,-74\n'), 'x.csv');
    const { rows, images } = await loadOutput(buffer);
    expect(statusOf(rows, 1)).toBe('Coverage 502; North Oblique ~45m 503; North Oblique ~375m 503');
    expect(images).toEqual([{ col: 2, row: 1 }]);
  });

  it('reports empty / undecodable tiles and thrown coverage errors in Status', async () => {
    installNearmapFetch({
      coverage: () => {
        throw new Error('socket hang up');
      },
      tile: (url) =>
        url.pathname.includes('/Vert/')
          ? new Response(new Uint8Array(0), { status: 200 })
          : new Response('not a jpeg', { status: 200 }),
    });
    const { buffer } = await generateIcemanWorkbook(csv('lat,lng\n40,-74\n'), 'x.csv');
    const { rows, images } = await loadOutput(buffer);
    const status = String(statusOf(rows, 1));
    expect(status.startsWith(`socket hang up; Top-Down ~${TOP_DOWN_M}m empty; North Oblique ~45m: `)).toBe(true);
    expect(status).toContain('North Oblique ~375m: ');
    expect(images).toHaveLength(0);
  });

  it('sends the API key on every Nearmap request', async () => {
    const { fetchMock } = installNearmapFetch({ tile: noTiles });
    await generateIcemanWorkbook(csv('lat,lng\n1.5,2.5\n'), 'x.csv');
    for (const [input] of fetchMock.mock.calls) {
      expect(new URL(String(input)).searchParams.get('apikey')).toBe('test-key');
    }
    expect(String(fetchMock.mock.calls[0][0])).toContain('/coverage/v2/point/2.5%2C1.5');
  });
});
