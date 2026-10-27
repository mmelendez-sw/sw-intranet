import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../salesforce', () => ({
  getTermSheetRankings: vi.fn(),
  getSalesforceHealth: vi.fn(),
}));
vi.mock('../powerbi', () => ({ getEmbedConfig: vi.fn() }));
vi.mock('../tvHomepageCards', () => ({
  getGraphToken: vi.fn(),
  getHomepageCardsMeta: vi.fn(),
}));
vi.mock('../enrichCards', () => ({ getHomepageCardsWithImages: vi.fn() }));
vi.mock('../tvImages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../tvImages')>();
  return {
    ImageNotAllowedError: actual.ImageNotAllowedError,
    ImageTooLargeError: actual.ImageTooLargeError,
    MAX_PROXY_IMAGE_BYTES: actual.MAX_PROXY_IMAGE_BYTES,
    getDriveImageContent: vi.fn(),
    getDriveImageContentByWebUrl: vi.fn(),
  };
});
vi.mock('../auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth')>();
  return { ...actual, authenticateRequest: vi.fn() };
});
vi.mock('../iceman', () => ({ generateIcemanWorkbook: vi.fn(), ICEMAN_MAX_ROWS: 15 }));

import { handler } from '../handler';
import { getSalesforceHealth, getTermSheetRankings } from '../salesforce';
import { getEmbedConfig } from '../powerbi';
import { getGraphToken, getHomepageCardsMeta } from '../tvHomepageCards';
import { getHomepageCardsWithImages } from '../enrichCards';
import {
  getDriveImageContent,
  getDriveImageContentByWebUrl,
  ImageNotAllowedError,
  ImageTooLargeError,
} from '../tvImages';
import { AuthError, AuthServiceError, authenticateRequest } from '../auth';
import { generateIcemanWorkbook } from '../iceman';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};
const IMAGE_CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=604800';

const ENV = ['TENANT_ID', 'CLIENT_ID', 'CLIENT_SECRET', 'ICEMAN_ALLOWED_EMAILS', 'SALESFORCE_ADMIN_EMAILS'] as const;
let savedEnv: Record<string, string | undefined>;

const user = (email: string) => ({ email, name: email });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  savedEnv = {};
  for (const k of ENV) savedEnv[k] = process.env[k];
  process.env.TENANT_ID = 'tenant';
  process.env.CLIENT_ID = 'client';
  process.env.CLIENT_SECRET = 'secret';
  delete process.env.ICEMAN_ALLOWED_EMAILS;
  delete process.env.SALESFORCE_ADMIN_EMAILS;
  vi.mocked(getGraphToken).mockResolvedValue('GRAPH_TOKEN');
  vi.mocked(authenticateRequest).mockResolvedValue(user('mmelendez@symphonyinfra.com'));
});

afterEach(() => {
  for (const k of ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.restoreAllMocks();
});

type Extra = Record<string, unknown>;

/** Lambda Function URL / HTTP API v2 event shape. */
function fnUrlEvent(path: string, method = 'GET', extra: Extra = {}) {
  return { rawPath: path, requestContext: { http: { path, method } }, ...extra };
}

/** API Gateway REST (v1) event shape. */
function apiGwEvent(path: string, method = 'GET', extra: Extra = {}) {
  return { path, httpMethod: method, ...extra };
}

const json = (res: { body: string }) => JSON.parse(res.body);

describe('routing basics', () => {
  it('OPTIONS → 204 with CORS headers (either event shape), no auth', async () => {
    for (const ev of [fnUrlEvent('/api/iceman/generate', 'OPTIONS'), apiGwEvent('/api/x', 'OPTIONS')]) {
      const res = await handler(ev);
      expect(res).toEqual({ statusCode: 204, headers: CORS, body: '' });
    }
    expect(authenticateRequest).not.toHaveBeenCalled();
  });

  it('unknown path → 404', async () => {
    const res = await handler(fnUrlEvent('/api/nope'));
    expect(res.statusCode).toBe(404);
    expect(res.headers).toEqual(CORS);
    expect(json(res)).toEqual({ error: 'Not found' });
  });

  it('unknown path → 404 even when Graph env vars are missing', async () => {
    delete process.env.TENANT_ID;
    const res = await handler(fnUrlEvent('/api/nope'));
    expect(res.statusCode).toBe(404);
  });

  it('TV routes → generic 500 when Graph env vars are missing', async () => {
    delete process.env.CLIENT_SECRET;
    const res = await handler(fnUrlEvent('/api/tv-cards'));
    expect(res.statusCode).toBe(500);
    expect(json(res)).toEqual({ error: 'API request failed' });
  });

  it('falls back to requestContext.http.path when rawPath/path missing', async () => {
    vi.mocked(getTermSheetRankings).mockResolvedValue({ monthLabel: 'October 2026', counts: [] });
    const res = await handler({
      headers: { Authorization: 'Bearer t' },
      requestContext: { http: { path: '/api/salesforce/term-sheet-rankings', method: 'GET' } },
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

describe('Salesforce routes (signed in)', () => {
  const rankings = { monthLabel: 'October 2026', counts: [{ name: 'A', count: 2 }] };

  it.each([
    ['fn url', fnUrlEvent],
    ['api gw', apiGwEvent],
  ])('term-sheet-rankings via %s passes the Authorization header to auth', async (_label, mk) => {
    vi.mocked(getTermSheetRankings).mockResolvedValue(rankings);
    const res = await handler(mk('/api/salesforce/term-sheet-rankings', 'GET', { headers: { authorization: 'Bearer abc' } }));
    expect(res.statusCode).toBe(200);
    expect(res.headers).toEqual({ ...CORS, 'Cache-Control': 'no-store' });
    expect(json(res)).toEqual(rankings);
    expect(authenticateRequest).toHaveBeenCalledWith('Bearer abc');
  });

  it('matches trailing slash, case and a stage prefix', async () => {
    vi.mocked(getTermSheetRankings).mockResolvedValue(rankings);
    for (const p of [
      '/api/salesforce/term-sheet-rankings/',
      '/API/Salesforce/Term-Sheet-Rankings',
      '/prod/api/salesforce/term-sheet-rankings',
    ]) {
      expect((await handler(fnUrlEvent(p))).statusCode).toBe(200);
    }
    expect(getTermSheetRankings).toHaveBeenCalledTimes(3);
  });

  it('401 with the auth message when the caller is not signed in', async () => {
    vi.mocked(authenticateRequest).mockRejectedValue(new AuthError('Sign in to use this endpoint'));
    const res = await handler(fnUrlEvent('/api/salesforce/term-sheet-rankings'));
    expect(res.statusCode).toBe(401);
    expect(json(res)).toEqual({ error: 'Sign in to use this endpoint' });
    expect(getTermSheetRankings).not.toHaveBeenCalled();
  });

  it('503 when sign-in verification is unavailable', async () => {
    vi.mocked(authenticateRequest).mockRejectedValue(new AuthServiceError());
    const res = await handler(fnUrlEvent('/api/salesforce/term-sheet-rankings'));
    expect(res.statusCode).toBe(503);
    expect(json(res)).toEqual({ error: 'Sign-in verification is temporarily unavailable' });
  });

  it('unexpected auth failures → generic 500', async () => {
    vi.mocked(authenticateRequest).mockRejectedValue(new Error('kaboom'));
    const res = await handler(fnUrlEvent('/api/salesforce/term-sheet-rankings'));
    expect(res.statusCode).toBe(500);
    expect(json(res)).toEqual({ error: 'API request failed' });
  });

  it('service throw → generic 500 without leaking the upstream message', async () => {
    vi.mocked(getTermSheetRankings).mockRejectedValue(new Error('INVALID_LOGIN: secret details'));
    const res = await handler(fnUrlEvent('/api/salesforce/term-sheet-rankings'));
    expect(res.statusCode).toBe(500);
    expect(json(res)).toEqual({ error: 'API request failed' });
  });

  it('salesforce routes do not need Graph env vars', async () => {
    delete process.env.TENANT_ID;
    vi.mocked(getTermSheetRankings).mockResolvedValue(rankings);
    expect((await handler(fnUrlEvent('/api/salesforce/term-sheet-rankings'))).statusCode).toBe(200);
  });

  describe('health', () => {
    const health = { ok: true, checkedAt: '2026-10-20T00:00:00.000Z' };

    it('returns the health payload to Salesforce admins (legacy domain normalized)', async () => {
      vi.mocked(getSalesforceHealth).mockResolvedValue(health);
      vi.mocked(authenticateRequest).mockResolvedValue(user('htolani@symphonywireless.com'));
      const res = await handler(fnUrlEvent('/api/salesforce/health'));
      expect(res.statusCode).toBe(200);
      expect(res.headers).toEqual({ ...CORS, 'Cache-Control': 'no-store' });
      expect(json(res)).toEqual(health);
    });

    it('403 for signed-in non-admins', async () => {
      vi.mocked(authenticateRequest).mockResolvedValue(user('shuang@symphonyinfra.com'));
      const res = await handler(fnUrlEvent('/api/salesforce/health'));
      expect(res.statusCode).toBe(403);
      expect(json(res)).toEqual({ error: 'Not a Salesforce admin.' });
      expect(getSalesforceHealth).not.toHaveBeenCalled();
    });

    it('honours SALESFORCE_ADMIN_EMAILS', async () => {
      process.env.SALESFORCE_ADMIN_EMAILS = ' Someone@SymphonyInfra.com ';
      vi.mocked(getSalesforceHealth).mockResolvedValue(health);
      vi.mocked(authenticateRequest).mockResolvedValue(user('someone@symphonyinfra.com'));
      expect((await handler(fnUrlEvent('/api/salesforce/health'))).statusCode).toBe(200);
      vi.mocked(authenticateRequest).mockResolvedValue(user('mmelendez@symphonyinfra.com'));
      expect((await handler(fnUrlEvent('/api/salesforce/health'))).statusCode).toBe(403);
    });

    it('auth disabled for local dev (null user) skips the admin check', async () => {
      vi.mocked(authenticateRequest).mockResolvedValue(null);
      vi.mocked(getSalesforceHealth).mockResolvedValue(health);
      expect((await handler(fnUrlEvent('/api/salesforce/health'))).statusCode).toBe(200);
    });
  });
});

describe('Power BI route', () => {
  it('passes reportId (or undefined) through without auth', async () => {
    vi.mocked(getEmbedConfig).mockResolvedValue({ embedToken: 'x' } as never);
    let res = await handler(fnUrlEvent('/api/powerbi/embed-token', 'GET', { queryStringParameters: { reportId: 'R1' } }));
    expect(res.statusCode).toBe(200);
    expect(res.headers).toEqual({ ...CORS, 'Cache-Control': 'no-store' });
    expect(getEmbedConfig).toHaveBeenLastCalledWith('R1');

    res = await handler(fnUrlEvent('/api/powerbi/embed-token', 'GET', { queryStringParameters: null }));
    expect(getEmbedConfig).toHaveBeenLastCalledWith(undefined);
    expect(authenticateRequest).not.toHaveBeenCalled();
  });
});

describe('TV cards routes', () => {
  it.each(['/api/tv-cards', '/api/tv-cards/', '/tv-cards', '/prod/api/tv-cards', '/'])('%s → enriched cards', async (p) => {
    vi.mocked(getHomepageCardsWithImages).mockResolvedValue([{ title: 'x' }] as never);
    const res = await handler(fnUrlEvent(p));
    expect(res.statusCode).toBe(200);
    expect(res.headers).toEqual({ ...CORS, 'Cache-Control': 'no-store' });
    expect(json(res)).toEqual([{ title: 'x' }]);
    expect(getHomepageCardsWithImages).toHaveBeenCalledWith('tenant', 'client', 'secret');
  });

  it('meta route returns Graph meta', async () => {
    const meta = { eTag: 'e', cTag: null, lastModifiedDateTime: null };
    vi.mocked(getHomepageCardsMeta).mockResolvedValue(meta);
    for (const p of ['/api/tv-cards/meta', '/tv-cards/meta/']) {
      const res = await handler(fnUrlEvent(p));
      expect(res.statusCode).toBe(200);
      expect(json(res)).toEqual(meta);
    }
    expect(getHomepageCardsMeta).toHaveBeenCalledWith('GRAPH_TOKEN');
    expect(getHomepageCardsWithImages).not.toHaveBeenCalled();
  });
});

describe('image proxy routes', () => {
  const bytes = new Uint8Array([1, 2, 3]).buffer;

  it('/api/images/:id decodes the id and returns base64 bytes with cache headers', async () => {
    vi.mocked(getDriveImageContent).mockResolvedValue({
      notModified: false,
      body: bytes,
      contentType: 'image/png',
      eTag: '"e1"',
    });
    const res = await handler(fnUrlEvent('/api/images/a%2Fb', 'GET', { headers: { 'If-None-Match': '"old"' } }));
    expect(getDriveImageContent).toHaveBeenCalledWith('a/b', 'GRAPH_TOKEN', '"old"');
    expect(res).toEqual({
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': IMAGE_CACHE_CONTROL,
        ETag: '"e1"',
        'Content-Type': 'image/png',
      },
      body: Buffer.from([1, 2, 3]).toString('base64'),
      isBase64Encoded: true,
    });
  });

  it('/api/images/:id → 304 when the eTag matches', async () => {
    vi.mocked(getDriveImageContent).mockResolvedValue({ notModified: true, eTag: '"e1"' });
    const res = await handler(fnUrlEvent('/api/images/abc', 'GET', { headers: { 'if-none-match': '"e1"' } }));
    expect(res).toEqual({
      statusCode: 304,
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': IMAGE_CACHE_CONTROL, ETag: '"e1"' },
      body: '',
    });
  });

  it('malformed percent-encoding → 400', async () => {
    const res = await handler(fnUrlEvent('/api/images/%E0%A4%A'));
    expect(res.statusCode).toBe(400);
    expect(json(res)).toEqual({ error: 'Malformed image id' });
    expect(getDriveImageContent).not.toHaveBeenCalled();
  });

  it('maps ImageNotAllowedError → 404 and ImageTooLargeError → 413', async () => {
    vi.mocked(getDriveImageContent).mockRejectedValueOnce(new ImageNotAllowedError());
    let res = await handler(fnUrlEvent('/api/images/x'));
    expect(res.statusCode).toBe(404);
    expect(json(res)).toEqual({ error: 'Image not found' });

    vi.mocked(getDriveImageContent).mockRejectedValueOnce(new ImageTooLargeError());
    res = await handler(fnUrlEvent('/api/images/x'));
    expect(res.statusCode).toBe(413);
    expect(json(res).error).toMatch(/^Image is too large to proxy \(limit 4\.5 MB\)/);
  });

  it('/api/images/by-url requires url', async () => {
    const res = await handler(fnUrlEvent('/api/images/by-url', 'GET', { queryStringParameters: { url: '  ' } }));
    expect(res.statusCode).toBe(400);
    expect(json(res)).toEqual({ error: 'Missing url query parameter' });
  });

  it('/api/images/by-url → 404 when the image cannot be fetched', async () => {
    vi.mocked(getDriveImageContentByWebUrl).mockResolvedValue(null);
    const res = await handler(fnUrlEvent('/api/images/by-url/', 'GET', { queryStringParameters: { url: 'https://sp/a.png' } }));
    expect(res.statusCode).toBe(404);
    expect(json(res)).toEqual({ error: 'Could not fetch SharePoint image' });
  });

  it('/api/images/by-url returns bytes (ETag only when present)', async () => {
    vi.mocked(getDriveImageContentByWebUrl).mockResolvedValue({ body: bytes, contentType: 'image/jpeg', eTag: null });
    const res = await handler(fnUrlEvent('/api/images/by-url', 'GET', { queryStringParameters: { url: ' https://sp/a.png ' } }));
    expect(getDriveImageContentByWebUrl).toHaveBeenCalledWith('https://sp/a.png', 'GRAPH_TOKEN');
    expect(res.statusCode).toBe(200);
    expect(res.headers).toEqual({
      'Content-Type': 'image/jpeg',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': IMAGE_CACHE_CONTROL,
    });
    expect(res.isBase64Encoded).toBe(true);
  });
});

describe('ICEMAN route', () => {
  const BOUNDARY = 'XyZ';
  function multipart(parts: Array<{ name: string; filename?: string; data: string }>) {
    const chunks = parts.map((p) => {
      const disp = p.filename
        ? `Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\nContent-Type: text/csv`
        : `Content-Disposition: form-data; name="${p.name}"`;
      return `--${BOUNDARY}\r\n${disp}\r\n\r\n${p.data}\r\n`;
    });
    return Buffer.from(`${chunks.join('')}--${BOUNDARY}--\r\n`).toString('base64');
  }
  const icemanEvent = (body: string, query: Record<string, string> = {}, method = 'POST') =>
    fnUrlEvent('/api/iceman/generate', method, {
      body,
      isBase64Encoded: true,
      headers: { 'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`, Authorization: 'Bearer t' },
      queryStringParameters: query,
    });
  const fileBody = (extra: Array<{ name: string; data: string }> = []) =>
    multipart([{ name: 'file', filename: 'sites.csv', data: 'lat,lng\n1,2' }, ...extra]);

  beforeEach(() => {
    vi.mocked(generateIcemanWorkbook).mockResolvedValue({
      buffer: Buffer.from('XLSX'),
      filename: 'iceman-output-2026-10-27.xlsx',
      rowCount: 1,
    });
  });

  it('returns the workbook as a base64 attachment', async () => {
    const res = await handler(icemanEvent(fileBody()));
    expect(res).toEqual({
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="iceman-output-2026-10-27.xlsx"',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
      body: Buffer.from('XLSX').toString('base64'),
      isBase64Encoded: true,
    });
    const [buf, name, maxRows, opts] = vi.mocked(generateIcemanWorkbook).mock.calls[0];
    expect(buf.toString()).toBe('lat,lng\n1,2');
    expect(name).toBe('sites.csv');
    expect(maxRows).toBe(15);
    expect(opts).toEqual({ closeObliqueMeters: undefined, farObliqueMeters: undefined });
  });

  it('clamps max_rows to 1..ICEMAN_MAX_ROWS and reads meters from query, then form fields', async () => {
    await handler(icemanEvent(fileBody(), { max_rows: '500', close_m: '30', far_m: '400' }));
    expect(vi.mocked(generateIcemanWorkbook).mock.calls[0].slice(2)).toEqual([
      15,
      { closeObliqueMeters: 30, farObliqueMeters: 400 },
    ]);

    await handler(
      icemanEvent(
        fileBody([
          { name: 'max_rows', data: '0' },
          { name: 'close_m', data: '25' },
          { name: 'farObliqueMeters', data: '600' },
        ])
      )
    );
    expect(vi.mocked(generateIcemanWorkbook).mock.calls[1].slice(2)).toEqual([
      1,
      { closeObliqueMeters: 25, farObliqueMeters: 600 },
    ]);

    await handler(icemanEvent(fileBody(), { max_rows: 'abc', close_m: 'x' }));
    expect(vi.mocked(generateIcemanWorkbook).mock.calls[2].slice(2)).toEqual([
      15,
      { closeObliqueMeters: undefined, farObliqueMeters: undefined },
    ]);
  });

  it('non-POST → 405', async () => {
    const res = await handler(icemanEvent('', {}, 'GET'));
    expect(res.statusCode).toBe(405);
    expect(json(res)).toEqual({ error: 'Method not allowed. Use POST.' });
  });

  it('401 when not signed in, 403 when not allowlisted', async () => {
    vi.mocked(authenticateRequest).mockRejectedValueOnce(new AuthError('Token expired'));
    let res = await handler(icemanEvent(fileBody()));
    expect(res.statusCode).toBe(401);
    expect(json(res)).toEqual({ error: 'Token expired' });

    vi.mocked(authenticateRequest).mockResolvedValueOnce(user('shuang@symphonyinfra.com'));
    res = await handler(icemanEvent(fileBody()));
    expect(res.statusCode).toBe(403);
    expect(json(res)).toEqual({ error: 'ICEMAN is not enabled for this account.' });
    expect(generateIcemanWorkbook).not.toHaveBeenCalled();
  });

  it('allows the default rollout list (legacy domain normalized) and honours ICEMAN_ALLOWED_EMAILS', async () => {
    vi.mocked(authenticateRequest).mockResolvedValueOnce(user('jcymbalista@symphonywireless.com'));
    expect((await handler(icemanEvent(fileBody()))).statusCode).toBe(200);

    process.env.ICEMAN_ALLOWED_EMAILS = 'other@symphonyinfra.com';
    vi.mocked(authenticateRequest).mockResolvedValueOnce(user('jcymbalista@symphonyinfra.com'));
    expect((await handler(icemanEvent(fileBody()))).statusCode).toBe(403);
    vi.mocked(authenticateRequest).mockResolvedValueOnce(user('other@symphonyinfra.com'));
    expect((await handler(icemanEvent(fileBody()))).statusCode).toBe(200);
  });

  it('missing file part → 400', async () => {
    const res = await handler(icemanEvent(multipart([{ name: 'close_m', data: '30' }])));
    expect(res.statusCode).toBe(400);
    expect(json(res)).toEqual({ error: 'Missing file upload. Use multipart field name "file".' });
  });

  it('missing body / content-type → 400 with the parser message', async () => {
    const res = await handler(
      fnUrlEvent('/api/iceman/generate', 'POST', { headers: { Authorization: 'Bearer t' } })
    );
    expect(res.statusCode).toBe(400);
    expect(json(res)).toEqual({ error: 'Missing request body or Content-Type' });
  });

  it('user-facing workbook errors → 400 with the message', async () => {
    vi.mocked(generateIcemanWorkbook).mockRejectedValueOnce(
      new Error('Missing latitude/longitude columns. Expected columns named lat/lng.')
    );
    const res = await handler(icemanEvent(fileBody()));
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toMatch(/^Missing latitude\/longitude columns/);
  });

  it('other errors (including non-Error rejections) → 500 generic message', async () => {
    vi.mocked(generateIcemanWorkbook).mockRejectedValueOnce(new Error('Missing required env var: NEARMAP_API_KEY'));
    let res = await handler(icemanEvent(fileBody()));
    expect(res.statusCode).toBe(500);
    expect(json(res)).toEqual({ error: 'ICEMAN request failed. Check the Lambda logs for details.' });

    vi.mocked(generateIcemanWorkbook).mockRejectedValueOnce('string failure');
    res = await handler(icemanEvent(fileBody()));
    expect(res.statusCode).toBe(500);
    expect(json(res)).toEqual({ error: 'ICEMAN request failed. Check the Lambda logs for details.' });
  });

  it('does not need Graph env vars', async () => {
    delete process.env.TENANT_ID;
    expect((await handler(icemanEvent(fileBody()))).statusCode).toBe(200);
  });
});
