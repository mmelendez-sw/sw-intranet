import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEmbedConfig } from '../powerbi';

const PBI_ENV = [
  'POWERBI_TENANT_ID',
  'POWERBI_CLIENT_ID',
  'POWERBI_USERNAME',
  'POWERBI_PASSWORD',
  'POWERBI_REPORT_ID',
  'POWERBI_WORKSPACE_ID',
] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const k of PBI_ENV) savedEnv[k] = process.env[k];
  process.env.POWERBI_TENANT_ID = 'tenant-1';
  process.env.POWERBI_CLIENT_ID = 'client-1';
  process.env.POWERBI_USERNAME = 'automation@symphonyinfra.com';
  process.env.POWERBI_PASSWORD = 'pw&=+';
  process.env.POWERBI_REPORT_ID = 'env-report';
  delete process.env.POWERBI_WORKSPACE_ID;
});

afterEach(() => {
  for (const k of PBI_ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const aadOk = () => Response.json({ access_token: 'AAD_TOKEN', token_type: 'Bearer' });
const reportOk = (id = 'env-report') =>
  Response.json({ id, embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${id}` });

function mockFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('getEmbedConfig', () => {
  it('requests an ROPC token with the right form fields', async () => {
    const fetchMock = mockFetch(aadOk(), reportOk(), Response.json({ token: 'EMBED', expiration: '2026-10-05T12:00:00Z' }));
    await getEmbedConfig();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    const form = init.body as URLSearchParams;
    expect(form.get('grant_type')).toBe('password');
    expect(form.get('client_id')).toBe('client-1');
    expect(form.get('username')).toBe('automation@symphonyinfra.com');
    expect(form.get('password')).toBe('pw&=+');
    expect(form.get('scope')).toBe(
      'https://analysis.windows.net/powerbi/api/Report.Read.All https://analysis.windows.net/powerbi/api/Dataset.Read.All offline_access'
    );
  });

  it('returns an Embed token from GenerateToken (My Workspace default)', async () => {
    const fetchMock = mockFetch(aadOk(), reportOk(), Response.json({ token: 'EMBED', expiration: '2026-10-05T12:00:00Z' }));
    await expect(getEmbedConfig()).resolves.toEqual({
      reportId: 'env-report',
      embedUrl: 'https://app.powerbi.com/reportEmbed?reportId=env-report',
      token: 'EMBED',
      tokenType: 'Embed',
      expiration: '2026-10-05T12:00:00Z',
    });

    expect(fetchMock.mock.calls[1][0]).toBe('https://api.powerbi.com/v1.0/myorg/reports/env-report');
    expect(fetchMock.mock.calls[1][1]).toEqual({ headers: { Authorization: 'Bearer AAD_TOKEN' } });
    const [genUrl, genInit] = fetchMock.mock.calls[2];
    expect(genUrl).toBe('https://api.powerbi.com/v1.0/myorg/reports/env-report/GenerateToken');
    expect(genInit.method).toBe('POST');
    expect(genInit.headers).toEqual({ Authorization: 'Bearer AAD_TOKEN', 'Content-Type': 'application/json' });
    expect(JSON.parse(genInit.body)).toEqual({ accessLevel: 'View' });
  });

  it('prefers the reportId argument over POWERBI_REPORT_ID', async () => {
    delete process.env.POWERBI_REPORT_ID;
    const fetchMock = mockFetch(aadOk(), reportOk('arg-report'), Response.json({ token: 'E' }));
    const out = await getEmbedConfig('arg-report');
    expect(out.reportId).toBe('arg-report');
    expect(out.expiration).toBe('');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.powerbi.com/v1.0/myorg/reports/arg-report');
  });

  it('uses /groups/{id} paths for a real workspace id', async () => {
    process.env.POWERBI_WORKSPACE_ID = ' ws-123 ';
    const fetchMock = mockFetch(aadOk(), reportOk(), Response.json({ token: 'E' }));
    await getEmbedConfig();
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.powerbi.com/v1.0/myorg/groups/ws-123/reports/env-report');
    expect(fetchMock.mock.calls[2][0]).toBe(
      'https://api.powerbi.com/v1.0/myorg/groups/ws-123/reports/env-report/GenerateToken'
    );
  });

  it.each(['me', 'MY', 'Personal', ''])('treats workspace %j as My Workspace', async (ws) => {
    process.env.POWERBI_WORKSPACE_ID = ws;
    const fetchMock = mockFetch(aadOk(), reportOk(), Response.json({ token: 'E' }));
    await getEmbedConfig();
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.powerbi.com/v1.0/myorg/reports/env-report');
  });

  it('falls back to the AAD token when GenerateToken is forbidden', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'));
    mockFetch(aadOk(), reportOk(), Response.json({ error: { code: 'PowerBINotAuthorizedException' } }, { status: 403 }));
    await expect(getEmbedConfig()).resolves.toEqual({
      reportId: 'env-report',
      embedUrl: 'https://app.powerbi.com/reportEmbed?reportId=env-report',
      token: 'AAD_TOKEN',
      tokenType: 'Aad',
      expiration: '2026-10-05T10:55:00.000Z',
    });
  });

  it('falls back to AAD when GenerateToken body is not JSON or lacks a token', async () => {
    mockFetch(aadOk(), reportOk(), new Response('oops', { status: 500 }));
    expect((await getEmbedConfig()).tokenType).toBe('Aad');
    mockFetch(aadOk(), reportOk(), Response.json({}));
    expect((await getEmbedConfig()).tokenType).toBe('Aad');
  });

  it.each([
    'POWERBI_TENANT_ID',
    'POWERBI_CLIENT_ID',
    'POWERBI_USERNAME',
    'POWERBI_PASSWORD',
  ])('throws when %s is missing', async (name) => {
    const fetchMock = mockFetch();
    delete process.env[name];
    await expect(getEmbedConfig()).rejects.toThrow(`Missing required env var: ${name}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when no reportId arg and POWERBI_REPORT_ID missing', async () => {
    delete process.env.POWERBI_REPORT_ID;
    mockFetch();
    await expect(getEmbedConfig()).rejects.toThrow('Missing required env var: POWERBI_REPORT_ID');
  });

  it('surfaces AAD error_description, then error, then status', async () => {
    mockFetch(Response.json({ error: 'invalid_grant', error_description: 'AADSTS50126: bad creds' }, { status: 400 }));
    await expect(getEmbedConfig()).rejects.toThrow('AADSTS50126: bad creds');
    mockFetch(Response.json({ error: 'invalid_grant' }, { status: 400 }));
    await expect(getEmbedConfig()).rejects.toThrow('invalid_grant');
    mockFetch(Response.json({}, { status: 401 }));
    await expect(getEmbedConfig()).rejects.toThrow('Azure AD ROPC token request failed (401)');
  });

  it('throws when a 200 AAD response has no access_token', async () => {
    mockFetch(Response.json({}));
    await expect(getEmbedConfig()).rejects.toThrow('Azure AD ROPC token request failed (200)');
  });

  it('surfaces report lookup errors', async () => {
    mockFetch(aadOk(), Response.json({ error: { message: 'Report not found' } }, { status: 404 }));
    await expect(getEmbedConfig()).rejects.toThrow('Report not found');
    mockFetch(aadOk(), Response.json({ id: 'x' }));
    await expect(getEmbedConfig()).rejects.toThrow('Failed to load Power BI report (200)');
  });
});
