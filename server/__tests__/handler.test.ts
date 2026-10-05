import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../salesforce', () => ({
  getCurrentInvestments: vi.fn(),
  getTermSheetRankings: vi.fn(),
}));
vi.mock('../powerbi', () => ({ getEmbedConfig: vi.fn() }));
vi.mock('../tvHomepageCards', () => ({
  getGraphToken: vi.fn(),
  getHomepageCardsMeta: vi.fn(),
}));
vi.mock('../enrichCards', () => ({ getHomepageCardsWithImages: vi.fn() }));
vi.mock('../tvImages', () => ({
  getDriveImageContent: vi.fn(),
  getDriveImageContentByWebUrl: vi.fn(),
  clearDefaultImagesCache: vi.fn(),
}));
vi.mock('../iceman', () => ({ generateIcemanWorkbook: vi.fn() }));

import { handler } from '../handler';
import { getCurrentInvestments, getTermSheetRankings } from '../salesforce';
import { getEmbedConfig } from '../powerbi';
import { getGraphToken, getHomepageCardsMeta } from '../tvHomepageCards';
import { getHomepageCardsWithImages } from '../enrichCards';
import { getDriveImageContent, getDriveImageContentByWebUrl, clearDefaultImagesCache } from '../tvImages';
import { generateIcemanWorkbook } from '../iceman';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const GRAPH_ENV = ['TENANT_ID', 'CLIENT_ID', 'CLIENT_SECRET'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  savedEnv = {};
  for (const k of GRAPH_ENV) savedEnv[k] = process.env[k];
  process.env.TENANT_ID = 'tenant';
  process.env.CLIENT_ID = 'client';
  process.env.CLIENT_SECRET = 'secret';
  vi.mocked(getGraphToken).mockResolvedValue('GRAPH_TOKEN');
});

afterEach(() => {
  for (const k of GRAPH_ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.restoreAllMocks();
});

/** Lambda Function URL / HTTP API v2 event shape. */
function fnUrlEvent(path: string, method = 'GET', extra: Record<string, unknown> = {}) {
  return { rawPath: path, requestContext: { http: { path, method } }, ...extra };
}

/** API Gateway REST (v1) event shape. */
function apiGwEvent(path: string, method = 'GET', extra: Record<string, unknown> = {}) {
  return { path, httpMethod: method, ...extra };
}

const json = (res: { body: string }) => JSON.parse(res.body);

describe('routing basics', () => {
  it('OPTIONS → 204 with CORS headers (either event shape)', async () => {
    for (const ev of [fnUrlEvent('/api/anything', 'OPTIONS'), apiGwEvent('/api/x', 'OPTIONS')]) {
      const res = await handler(ev);
      expect(res).toEqual({ statusCode: 204, headers: CORS, body: '' });
    }
  });

  it('unknown path → 404', async () => {
    const res = await handler(fnUrlEvent('/api/nope'));
    expect(res.statusCode).toBe(404);
    expect(res.headers).toEqual(CORS);
    expect(json(res)).toEqual({ error: 'Not found' });
  });

  it('KNOWN ISSUE: unknown path → 500 (not 404) when Graph env vars are missing', async () => {
    delete process.env.TENANT_ID;
    const res = await handler(fnUrlEvent('/api/nope'));
    expect(res.statusCode).toBe(500);
  });

  it('falls back to requestContext.http.path when rawPath/path missing', async () => {
    vi.mocked(getCurrentInvestments).mockResolvedValue({ records: [] });
    const res = await handler({
      requestContext: { http: { path: '/api/salesforce/current-investments', method: 'GET' } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('an empty event resolves to path "" → 404 (only an explicit "/" maps to cards)', async () => {
    const res = await handler(undefined);
    expect(res.statusCode).toBe(404);
    expect(getHomepageCardsWithImages).not.toHaveBeenCalled();

    vi.mocked(getHomepageCardsWithImages).mockResolvedValue([]);
    expect((await handler({ rawPath: '/' })).statusCode).toBe(200);
  });
});

describe('Salesforce + Power BI routes', () => {
  it.each([
    ['fn url', fnUrlEvent],
    ['api gw', apiGwEvent],
  ])('current-investments via %s', async (_label, mk) => {
    vi.mocked(getCurrentInvestments).mockResolvedValue({ totalSize: 1, records: [{ Id: '1' }] });
    const res = await handler(mk('/api/salesforce/current-investments'));
    expect(res.statusCode).toBe(200);
    expect(res.headers).toEqual({ ...CORS, 'Cache-Control': 'no-store' });
    expect(json(res)).toEqual({ totalSize: 1, records: [{ Id: '1' }] });
    expect(getCurrentInvestments).toHaveBeenCalledTimes(1);
    expect(getTermSheetRankings).not.toHaveBeenCalled();
  });

  it('term-sheet-rankings (trailing slash, case-insensitive, stage prefix)', async () => {
    const payload = { monthLabel: 'October 2026', rankings: [], unmatchedManagers: [] };
    vi.mocked(getTermSheetRankings).mockResolvedValue(payload);
    for (const p of [
      '/api/salesforce/term-sheet-rankings',
      '/api/salesforce/term-sheet-rankings/',
      '/API/Salesforce/Term-Sheet-Rankings',
      '/prod/api/salesforce/term-sheet-rankings',
    ]) {
      const res = await handler(apiGwEvent(p));
      expect(res.statusCode).toBe(200);
      expect(json(res)).toEqual(payload);
    }
    expect(getTermSheetRankings).toHaveBeenCalledTimes(4);
  });

  it('salesforce routes do not need Graph env vars', async () => {
    delete process.env.TENANT_ID;
    vi.mocked(getTermSheetRankings).mockResolvedValue({ monthLabel: 'x', rankings: [], unmatchedManagers: [] });
    expect((await handler(fnUrlEvent('/api/salesforce/term-sheet-rankings'))).statusCode).toBe(200);
  });

  it('service throw → 500 with the error message', async () => {
    vi.mocked(getTermSheetRankings).mockRejectedValue(new Error('INVALID_LOGIN: bad'));
    const res = await handler(fnUrlEvent('/api/salesforce/term-sheet-rankings'));
    expect(res.statusCode).toBe(500);
    expect(res.headers).toEqual(CORS);
    expect(json(res)).toEqual({ error: 'INVALID_LOGIN: bad' });
  });

  it('non-Error throw → generic 500 message', async () => {
    vi.mocked(getCurrentInvestments).mockRejectedValue('string failure');
    const res = await handler(fnUrlEvent('/api/salesforce/current-investments'));
    expect(res.statusCode).toBe(500);
    expect(json(res)).toEqual({ error: 'API request failed' });
  });

  it('powerbi embed-token passes reportId (or undefined)', async () => {
    const cfg = { reportId: 'r', embedUrl: 'u', token: 't', tokenType: 'Embed' as const, expiration: '' };
    vi.mocked(getEmbedConfig).mockResolvedValue(cfg);

    const res = await handler(fnUrlEvent('/api/powerbi/embed-token', 'GET', { queryStringParameters: { reportId: 'abc' } }));
    expect(res.statusCode).toBe(200);
    expect(json(res)).toEqual(cfg);
    expect(getEmbedConfig).toHaveBeenLastCalledWith('abc');

    await handler(fnUrlEvent('/api/powerbi/embed-token', 'GET', { queryStringParameters: null }));
    expect(getEmbedConfig).toHaveBeenLastCalledWith(undefined);

    await handler(fnUrlEvent('/api/powerbi/embed-token', 'GET', { queryStringParameters: { reportId: '' } }));
    expect(getEmbedConfig).toHaveBeenLastCalledWith(undefined);
  });

  it('powerbi failure → 500', async () => {
    vi.mocked(getEmbedConfig).mockRejectedValue(new Error('Missing required env var: POWERBI_REPORT_ID'));
    const res = await handler(apiGwEvent('/api/powerbi/embed-token'));
    expect(res.statusCode).toBe(500);
    expect(json(res).error).toBe('Missing required env var: POWERBI_REPORT_ID');
  });
});

describe('Graph / TV routes', () => {
  it.each(['TENANT_ID', 'CLIENT_ID', 'CLIENT_SECRET'])('500 when %s missing', async (name) => {
    delete process.env[name];
    const res = await handler(fnUrlEvent('/api/tv-cards'));
    expect(res.statusCode).toBe(500);
    expect(json(res)).toEqual({ error: `Missing required env var: ${name}` });
    expect(getHomepageCardsWithImages).not.toHaveBeenCalled();
  });

  it.each(['/', '/api/tv-cards', '/api/tv-cards/', '/tv-cards'])('cards at %s', async (p) => {
    vi.mocked(getHomepageCardsWithImages).mockResolvedValue([{ order: 1, title: 't', bullets: [], imageUrl: '' }]);
    const res = await handler(fnUrlEvent(p));
    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(json(res)).toHaveLength(1);
    expect(clearDefaultImagesCache).toHaveBeenCalledTimes(1);
    expect(getHomepageCardsWithImages).toHaveBeenCalledWith('tenant', 'client', 'secret');
  });

  it('cards meta', async () => {
    const meta = { eTag: 'e', cTag: null, lastModifiedDateTime: null };
    vi.mocked(getHomepageCardsMeta).mockResolvedValue(meta);
    const res = await handler(apiGwEvent('/api/tv-cards/meta'));
    expect(res.statusCode).toBe(200);
    expect(json(res)).toEqual(meta);
    expect(getGraphToken).toHaveBeenCalledWith('tenant', 'client', 'secret');
    expect(getHomepageCardsMeta).toHaveBeenCalledWith('GRAPH_TOKEN');
    expect(getHomepageCardsWithImages).not.toHaveBeenCalled();
  });

  it('image proxy by id returns base64 bytes', async () => {
    vi.mocked(getDriveImageContent).mockResolvedValue({
      body: new Uint8Array([1, 2, 3]).buffer,
      contentType: 'image/png',
    });
    const res = await handler(fnUrlEvent('/api/images/ITEM%2F1'));
    expect(getDriveImageContent).toHaveBeenCalledWith('ITEM/1', 'GRAPH_TOKEN');
    expect(res).toEqual({
      statusCode: 200,
      headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
      body: Buffer.from([1, 2, 3]).toString('base64'),
      isBase64Encoded: true,
    });
  });

  it('image by-url: 400 without url, 404 when not fetched, 200 on success', async () => {
    let res = await handler(fnUrlEvent('/api/images/by-url', 'GET', { queryStringParameters: { url: '  ' } }));
    expect(res.statusCode).toBe(400);
    expect(json(res)).toEqual({ error: 'Missing url query parameter' });

    vi.mocked(getDriveImageContentByWebUrl).mockResolvedValueOnce(null);
    res = await handler(fnUrlEvent('/api/images/by-url', 'GET', { queryStringParameters: { url: 'https://x.sharepoint.com/a.png' } }));
    expect(res.statusCode).toBe(404);

    vi.mocked(getDriveImageContentByWebUrl).mockResolvedValueOnce({ body: new Uint8Array([9]).buffer, contentType: 'image/jpeg' });
    res = await handler(fnUrlEvent('/api/images/by-url/', 'GET', { queryStringParameters: { url: ' https://x.sharepoint.com/a.png ' } }));
    expect(res.statusCode).toBe(200);
    expect(res.isBase64Encoded).toBe(true);
    expect(getDriveImageContentByWebUrl).toHaveBeenLastCalledWith('https://x.sharepoint.com/a.png', 'GRAPH_TOKEN');
    expect(getDriveImageContent).not.toHaveBeenCalled();
  });
});

// ── ICEMAN ───────────────────────────────────────────────────────────────────

const BOUNDARY = 'handlerTestBoundary';
const MP_CT = `multipart/form-data; boundary=${BOUNDARY}`;

function multipart(fields: Record<string, string>, file?: { filename: string; data: string }): string {
  let s = '';
  for (const [k, v] of Object.entries(fields)) {
    s += `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
  }
  if (file) {
    s += `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: text/csv\r\n\r\n${file.data}\r\n`;
  }
  return `${s}--${BOUNDARY}--\r\n`;
}

function icemanEvent(body: string | undefined, opts: { query?: Record<string, string>; base64?: boolean; headers?: Record<string, string> } = {}) {
  return fnUrlEvent('/api/iceman/generate', 'POST', {
    headers: opts.headers ?? { 'Content-Type': MP_CT },
    body: body === undefined ? undefined : opts.base64 ? Buffer.from(body).toString('base64') : body,
    isBase64Encoded: !!opts.base64,
    queryStringParameters: opts.query ?? null,
  });
}

const CSV = { filename: 'sites.csv', data: 'lat,lng\n40,-74\n' };

describe('ICEMAN route', () => {
  beforeEach(() => {
    vi.mocked(generateIcemanWorkbook).mockResolvedValue({
      buffer: Buffer.from('XLSXBYTES'),
      filename: 'iceman-output-2026-10-05.xlsx',
    });
  });

  it('GET → 405', async () => {
    const res = await handler(fnUrlEvent('/api/iceman/generate', 'GET'));
    expect(res.statusCode).toBe(405);
    expect(json(res)).toEqual({ error: 'Method not allowed. Use POST.' });
  });

  it('does not need Graph env vars', async () => {
    delete process.env.TENANT_ID;
    const res = await handler(icemanEvent(multipart({}, CSV)));
    expect(res.statusCode).toBe(200);
  });

  it('missing file → 400', async () => {
    const res = await handler(icemanEvent(multipart({ max_rows: '5' })));
    expect(res.statusCode).toBe(400);
    expect(json(res)).toEqual({ error: 'Missing file upload. Use multipart field name "file".' });
    expect(generateIcemanWorkbook).not.toHaveBeenCalled();
  });

  it('missing body or content-type → 400', async () => {
    expect((await handler(icemanEvent(undefined))).statusCode).toBe(400);
    const res = await handler(icemanEvent(multipart({}, CSV), { headers: {} }));
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('Missing request body or Content-Type');
  });

  it('success → base64 xlsx with Content-Disposition (base64 body, lowercase header)', async () => {
    const res = await handler(
      icemanEvent(multipart({}, CSV), { base64: true, headers: { 'content-type': MP_CT } })
    );
    expect(res).toEqual({
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="iceman-output-2026-10-05.xlsx"',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
      body: Buffer.from('XLSXBYTES').toString('base64'),
      isBase64Encoded: true,
    });
    const [buf, name, maxRows, opts] = vi.mocked(generateIcemanWorkbook).mock.calls[0];
    expect(buf.toString()).toBe(CSV.data);
    expect(name).toBe('sites.csv');
    expect(maxRows).toBe(500);
    expect(opts).toEqual({ closeObliqueMeters: undefined, farObliqueMeters: undefined });
  });

  it.each([
    [{ max_rows: '0' }, 1],
    [{ max_rows: '9999' }, 500],
    [{ max_rows: 'abc' }, 500],
    [{ max_rows: '-5' }, 1],
    [{ max_rows: '25' }, 25],
    [{ max_rows: '' }, 500],
  ])('query %j → maxRows %d', async (query, expected) => {
    await handler(icemanEvent(multipart({}, CSV), { query }));
    expect(vi.mocked(generateIcemanWorkbook).mock.calls[0][2]).toBe(expected);
  });

  it('KNOWN ISSUE: fractional max_rows is passed through unrounded', async () => {
    await handler(icemanEvent(multipart({}, CSV), { query: { max_rows: '2.5' } }));
    expect(vi.mocked(generateIcemanWorkbook).mock.calls[0][2]).toBe(2.5);
  });

  it('reads max_rows / meters from form fields; query wins over fields', async () => {
    await handler(icemanEvent(multipart({ max_rows: '7', close_m: '20', farObliqueMeters: '450' }, CSV)));
    let call = vi.mocked(generateIcemanWorkbook).mock.calls[0];
    expect(call[2]).toBe(7);
    expect(call[3]).toEqual({ closeObliqueMeters: 20, farObliqueMeters: 450 });

    vi.mocked(generateIcemanWorkbook).mockClear();
    await handler(
      icemanEvent(multipart({ max_rows: '7', close_m: '20', far_m: '450' }, CSV), {
        query: { max_rows: '3', close_m: '45', far_m: 'abc' },
      })
    );
    call = vi.mocked(generateIcemanWorkbook).mock.calls[0];
    expect(call[2]).toBe(3);
    expect(call[3]).toEqual({ closeObliqueMeters: 45, farObliqueMeters: undefined });
  });

  it.each([
    ['Missing latitude/longitude columns. Expected ...', 400],
    ['Unsupported file type. Upload .csv or .xlsx.', 400],
    ['No valid coordinate rows found. Check lat/lng values are numeric.', 400],
    ['File has no data rows.', 400],
    ['exceljs exploded', 500],
    ['ECONNRESET', 500],
    // KNOWN ISSUE: server misconfiguration matches /missing/ and is reported as a client error.
    ['Missing required env var: NEARMAP_API_KEY', 400],
  ])('error %j → %d', async (msg, status) => {
    vi.mocked(generateIcemanWorkbook).mockRejectedValue(new Error(msg));
    const res = await handler(icemanEvent(multipart({}, CSV)));
    expect(res.statusCode).toBe(status);
    expect(res.headers).toEqual(CORS);
    expect(json(res)).toEqual({ error: msg });
  });

  it('non-Error rejection → 500 generic message', async () => {
    vi.mocked(generateIcemanWorkbook).mockRejectedValue(42);
    const res = await handler(icemanEvent(multipart({}, CSV)));
    expect(res.statusCode).toBe(500);
    expect(json(res)).toEqual({ error: 'ICEMAN request failed' });
  });

  it('API Gateway shape works too', async () => {
    const res = await handler(
      apiGwEvent('/api/iceman/generate/', 'POST', {
        headers: { 'Content-Type': MP_CT },
        body: multipart({}, CSV),
      })
    );
    expect(res.statusCode).toBe(200);
  });
});
