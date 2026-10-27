import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type SalesforceModule = typeof import('../salesforce');

const SF_ENV = [
  'SF_USERNAME',
  'SF_PASSWORD',
  'SF_SECURITY_TOKEN',
  'SF_DOMAIN',
  'SF_PASSWORD_EXPIRY_DAYS',
] as const;
let savedEnv: Record<string, string | undefined>;

const INSTANCE = 'https://symphony.my.salesforce.com';

function loginOk(serverUrl = `${INSTANCE}/services/Soap/u/60.0/00Dxx0000001`) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="urn:partner.soap.sforce.com">
<soapenv:Body><loginResponse><result>
<metadataServerUrl>${INSTANCE}/services/Soap/m/60.0/00Dxx</metadataServerUrl>
<passwordExpired>false</passwordExpired>
<serverUrl>${serverUrl}</serverUrl>
<sessionId>00Dxx!SESSION.TOKEN</sessionId>
</result></loginResponse></soapenv:Body></soapenv:Envelope>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}

function loginFault(message: string, faultCode = 'sf:INVALID_LOGIN', status = 500) {
  return new Response(
    `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault><faultcode>${faultCode}</faultcode><faultstring>${message}</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`,
    { status, headers: { 'Content-Type': 'text/xml' } }
  );
}

function queryOk(records: Array<Record<string, unknown>>) {
  return Response.json({ totalSize: records.length, done: true, records });
}

const tzOk = (tz: string | null = 'America/New_York') => queryOk([{ TimeZoneSidKey: tz }]);

function mockFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** The module keeps session / timezone / result caches, so load a fresh copy per test. */
async function load(): Promise<SalesforceModule> {
  vi.resetModules();
  return import('../salesforce.js');
}

const soqlOf = (url: unknown) => decodeURIComponent(new URL(String(url)).searchParams.get('q') || '');

beforeEach(() => {
  savedEnv = {};
  for (const k of SF_ENV) savedEnv[k] = process.env[k];
  process.env.SF_USERNAME = 'automation@symphonyinfra.com';
  process.env.SF_PASSWORD = 'p@ss<&>"\'';
  process.env.SF_SECURITY_TOKEN = 'TOKEN123';
  delete process.env.SF_DOMAIN;
  delete process.env.SF_PASSWORD_EXPIRY_DAYS;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  for (const k of SF_ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Salesforce login (SOAP)', () => {
  it('posts a SOAP login with escaped username/password+token', async () => {
    const sf = await load();
    const fetchMock = mockFetch(loginOk(), queryOk([]));
    await sf.getSalesforceHealth();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://login.salesforce.com/services/Soap/u/60.0');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: 'login' });
    expect(init.body).toContain('<n1:username>automation@symphonyinfra.com</n1:username>');
    expect(init.body).toContain('<n1:password>p@ss&lt;&amp;&gt;&quot;&apos;TOKEN123</n1:password>');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('works without a security token', async () => {
    delete process.env.SF_SECURITY_TOKEN;
    const sf = await load();
    const fetchMock = mockFetch(loginOk(), queryOk([]));
    await sf.getSalesforceHealth();
    expect(fetchMock.mock.calls[0][1].body).toContain('<n1:password>p@ss&lt;&amp;&gt;&quot;&apos;</n1:password>');
  });

  it.each([
    [undefined, 'https://login.salesforce.com'],
    ['login', 'https://login.salesforce.com'],
    ['test', 'https://test.salesforce.com'],
    ['  test  ', 'https://test.salesforce.com'],
    ['symphony', 'https://symphony.my.salesforce.com'],
    ['symphony.my.salesforce.com', 'https://symphony.my.salesforce.com'],
    ['symphony.my.salesforce.com/', 'https://symphony.my.salesforce.com'],
    ['https://custom.example.com/', 'https://custom.example.com'],
    ['HTTP://custom.example.com', 'HTTP://custom.example.com'],
  ])('SF_DOMAIN=%j → %s', async (domain, base) => {
    if (domain === undefined) delete process.env.SF_DOMAIN;
    else process.env.SF_DOMAIN = domain;
    const sf = await load();
    const fetchMock = mockFetch(loginOk(), queryOk([]));
    await sf.getSalesforceHealth();
    expect(fetchMock.mock.calls[0][0]).toBe(`${base}/services/Soap/u/60.0`);
  });

  it('queries the instance origin from serverUrl with the session as Bearer', async () => {
    const sf = await load();
    const fetchMock = mockFetch(loginOk('https://na1.salesforce.com/services/Soap/u/60.0/00D'), queryOk([]));
    await sf.getSalesforceHealth();
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url).startsWith('https://na1.salesforce.com/services/data/v60.0/query?q=')).toBe(true);
    expect(init.headers).toEqual({ Authorization: 'Bearer 00Dxx!SESSION.TOKEN', Accept: 'application/json' });
  });
});

describe('getSalesforceHealth', () => {
  it('reports ok with password age when the login and User query succeed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
    const sf = await load();
    const fetchMock = mockFetch(loginOk(), queryOk([{ LastPasswordChangeDate: '2026-08-01T12:00:00Z' }]));

    const health = await sf.getSalesforceHealth();
    expect(health).toEqual({
      ok: true,
      checkedAt: '2026-10-20T12:00:00.000Z',
      passwordChangedAt: '2026-08-01T12:00:00Z',
      // 90-day default policy: Aug 1 + 90 days = Oct 30 → 10 days left.
      passwordExpiresInDays: 10,
    });
    expect(soqlOf(fetchMock.mock.calls[1][0])).toBe(
      "SELECT LastPasswordChangeDate FROM User WHERE Username = 'automation@symphonyinfra.com' LIMIT 1"
    );
  });

  it('escapes quotes and backslashes in the username SOQL literal', async () => {
    process.env.SF_USERNAME = "o'brien\\x@symphonyinfra.com";
    const sf = await load();
    const fetchMock = mockFetch(loginOk(), queryOk([]));
    await sf.getSalesforceHealth();
    expect(soqlOf(fetchMock.mock.calls[1][0])).toContain("Username = 'o\\'brien\\\\x@symphonyinfra.com'");
  });

  it('omits the expiry countdown when SF_PASSWORD_EXPIRY_DAYS is 0', async () => {
    process.env.SF_PASSWORD_EXPIRY_DAYS = '0';
    const sf = await load();
    mockFetch(loginOk(), queryOk([{ LastPasswordChangeDate: '2026-08-01T12:00:00Z' }]));
    const health = await sf.getSalesforceHealth();
    expect(health.ok).toBe(true);
    expect(health.passwordChangedAt).toBe('2026-08-01T12:00:00Z');
    expect(health).not.toHaveProperty('passwordExpiresInDays');
  });

  it('maps an expired-password fault to password_expired', async () => {
    const sf = await load();
    mockFetch(loginFault('Password expired', 'sf:INVALID_OPERATION_WITH_EXPIRED_PASSWORD'));
    const health = await sf.getSalesforceHealth();
    expect(health.ok).toBe(false);
    expect(health.problem).toBe('password_expired');
  });

  it('maps other login faults to login_failed', async () => {
    const sf = await load();
    mockFetch(loginFault('Invalid username, password, security token; or user locked out.'));
    expect((await sf.getSalesforceHealth()).problem).toBe('login_failed');
  });

  it('treats a 200 response containing <faultcode> as a login failure', async () => {
    const sf = await load();
    mockFetch(loginFault('nope', 'sf:INVALID_LOGIN', 200));
    expect((await sf.getSalesforceHealth()).problem).toBe('login_failed');
  });

  it('maps non-login errors (missing env, query failure) to check_failed', async () => {
    delete process.env.SF_PASSWORD;
    let sf = await load();
    const fetchMock = mockFetch();
    expect((await sf.getSalesforceHealth()).problem).toBe('check_failed');
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.SF_PASSWORD = 'x';
    sf = await load();
    mockFetch(loginOk(), Response.json([{ message: 'boom' }], { status: 400 }));
    expect((await sf.getSalesforceHealth()).problem).toBe('check_failed');
  });

  it('caches the result for 15 minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
    const sf = await load();
    const fetchMock = mockFetch(loginOk(), queryOk([]), loginOk(), queryOk([]));
    const first = await sf.getSalesforceHealth();
    vi.setSystemTime(new Date('2026-10-20T12:14:00Z'));
    expect(await sf.getSalesforceHealth()).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.setSystemTime(new Date('2026-10-20T12:16:00Z'));
    await sf.getSalesforceHealth();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('logs in afresh even when a session is cached', async () => {
    const sf = await load();
    const fetchMock = mockFetch(loginOk(), tzOk(), queryOk([]), loginOk(), queryOk([]));
    await sf.getTermSheetRankings();
    await sf.getSalesforceHealth();
    expect(fetchMock.mock.calls[3][0]).toBe('https://login.salesforce.com/services/Soap/u/60.0');
  });
});

describe('getTermSheetRankings', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
  });

  it('looks up the org timezone, then sends the grouped proprietary term-sheet SOQL', async () => {
    const sf = await load();
    const fetchMock = mockFetch(loginOk(), tzOk('America/Los_Angeles'), queryOk([]));
    await expect(sf.getTermSheetRankings()).resolves.toEqual({ monthLabel: 'October 2026', counts: [] });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(soqlOf(fetchMock.mock.calls[1][0])).toBe('SELECT TimeZoneSidKey FROM Organization');
    const soql = soqlOf(fetchMock.mock.calls[2][0]);
    expect(soql).toContain('FROM Opportunity');
    expect(soql).toContain('Term_Sheet_Signed_Date__c = THIS_MONTH');
    expect(soql).toContain("Source_Type__c = 'Proprietary'");
    expect(soql).toContain('GROUP BY Acquisition_Advisor_Manager__r.Name');
  });

  it('maps aggregate rows (flat or nested name), drops blanks/zeros and sorts by count then name', async () => {
    const sf = await load();
    mockFetch(
      loginOk(),
      tzOk(),
      queryOk([
        { Name: ' Zed Manager ', expr0: 3 },
        { Acquisition_Advisor_Manager__r: { Name: 'Amy Manager' }, expr0: 3 },
        { Name: 'Bob Manager', expr0: 5 },
        { Name: null, expr0: 9 },
        { Name: 'No Sheets', expr0: 0 },
        { Name: 'Junk', expr0: 'x' },
      ])
    );
    const out = await sf.getTermSheetRankings();
    expect(out.counts).toEqual([
      { name: 'Bob Manager', count: 5 },
      { name: 'Amy Manager', count: 3 },
      { name: 'Zed Manager', count: 3 },
    ]);
  });

  it('returns no counts when the response has no records array', async () => {
    const sf = await load();
    mockFetch(loginOk(), tzOk(), Response.json({ done: true }));
    expect((await sf.getTermSheetRankings()).counts).toEqual([]);
  });

  it('labels the month in the org timezone (not UTC)', async () => {
    vi.setSystemTime(new Date('2026-11-01T02:00:00Z')); // still Oct 31 in New York
    const sf = await load();
    mockFetch(loginOk(), tzOk('America/New_York'), queryOk([]));
    expect((await sf.getTermSheetRankings()).monthLabel).toBe('October 2026');
  });

  it('falls back to America/New_York for an unknown or failed timezone lookup', async () => {
    vi.setSystemTime(new Date('2026-11-01T02:00:00Z'));
    let sf = await load();
    mockFetch(loginOk(), tzOk('Not/AZone'), queryOk([]));
    expect((await sf.getTermSheetRankings()).monthLabel).toBe('October 2026');

    sf = await load();
    mockFetch(loginOk(), Response.json([{ message: 'nope' }], { status: 400 }), queryOk([]));
    expect((await sf.getTermSheetRankings()).monthLabel).toBe('October 2026');
  });

  it('reuses one login across queries and caches results for five minutes', async () => {
    const sf = await load();
    const fetchMock = mockFetch(
      loginOk(),
      tzOk(),
      queryOk([{ Name: 'A', expr0: 1 }]),
      queryOk([{ Name: 'A', expr0: 2 }])
    );
    const first = await sf.getTermSheetRankings();
    vi.setSystemTime(new Date('2026-10-15T12:04:00Z'));
    expect(await sf.getTermSheetRankings()).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    vi.setSystemTime(new Date('2026-10-15T12:06:00Z'));
    expect((await sf.getTermSheetRankings()).counts).toEqual([{ name: 'A', count: 2 }]);
    // No second login and no second timezone lookup.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not serve a cached count across a month rollover', async () => {
    vi.setSystemTime(new Date('2026-11-01T03:58:00Z')); // 23:58 Oct 31 in New York
    const sf = await load();
    const fetchMock = mockFetch(loginOk(), tzOk(), queryOk([{ Name: 'A', expr0: 7 }]), queryOk([]));
    await sf.getTermSheetRankings();
    vi.setSystemTime(new Date('2026-11-01T04:01:00Z')); // 3 minutes later: 00:01 Nov 1 in New York
    const out = await sf.getTermSheetRankings();
    expect(out).toEqual({ monthLabel: 'November 2026', counts: [] });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('logs in again and retries once when the session has expired', async () => {
    const sf = await load();
    const fetchMock = mockFetch(
      loginOk(),
      tzOk(),
      Response.json([{ errorCode: 'INVALID_SESSION_ID', message: 'Session expired' }], { status: 401 }),
      loginOk(),
      queryOk([{ Name: 'A', expr0: 1 }])
    );
    expect((await sf.getTermSheetRankings()).counts).toEqual([{ name: 'A', count: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[3][0]).toBe('https://login.salesforce.com/services/Soap/u/60.0');
  });

  it('surfaces the first Salesforce error message on query failure', async () => {
    const sf = await load();
    mockFetch(loginOk(), tzOk(), Response.json([{ message: 'MALFORMED_QUERY: bad' }], { status: 400 }));
    await expect(sf.getTermSheetRankings()).rejects.toThrow('MALFORMED_QUERY: bad');
  });

  it('falls back to a status message for non-array or non-JSON error bodies', async () => {
    let sf = await load();
    mockFetch(loginOk(), tzOk(), Response.json({ error: 'x' }, { status: 503 }));
    await expect(sf.getTermSheetRankings()).rejects.toThrow('Salesforce query failed (503)');

    sf = await load();
    mockFetch(loginOk(), tzOk(), new Response('<html>', { status: 502 }));
    await expect(sf.getTermSheetRankings()).rejects.toThrow('Salesforce query failed (502)');
  });

  // The timezone lookup swallows its own failure, so the leaderboard query logs in a second time.
  it('surfaces SOAP login failures', async () => {
    let sf = await load();
    mockFetch(loginFault('INVALID_LOGIN: bad password'), loginFault('INVALID_LOGIN: bad password'));
    await expect(sf.getTermSheetRankings()).rejects.toBeInstanceOf(sf.SalesforceLoginError);

    sf = await load();
    mockFetch(new Response('', { status: 503 }), new Response('', { status: 503 }));
    await expect(sf.getTermSheetRankings()).rejects.toThrow('Salesforce login failed (503)');

    sf = await load();
    mockFetch(new Response('<ok/>', { status: 200 }), new Response('<ok/>', { status: 200 }));
    await expect(sf.getTermSheetRankings()).rejects.toThrow('Salesforce login response missing session details');
  });
});
