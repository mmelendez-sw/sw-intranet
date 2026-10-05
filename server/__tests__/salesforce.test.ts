import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCurrentInvestments,
  fetchTermSheetCountsFromSalesforce,
} from '../salesforce';

const SF_ENV = ['SF_USERNAME', 'SF_PASSWORD', 'SF_SECURITY_TOKEN', 'SF_DOMAIN'] as const;
let savedEnv: Record<string, string | undefined>;

function loginOk(serverUrl = 'https://symphony.my.salesforce.com/services/Soap/u/60.0/00Dxx0000001') {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="urn:partner.soap.sforce.com">
<soapenv:Body><loginResponse><result>
<metadataServerUrl>https://symphony.my.salesforce.com/services/Soap/m/60.0/00Dxx</metadataServerUrl>
<passwordExpired>false</passwordExpired>
<serverUrl>${serverUrl}</serverUrl>
<sessionId>00Dxx!SESSION.TOKEN</sessionId>
</result></loginResponse></soapenv:Body></soapenv:Envelope>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}

function loginFault(message: string, status = 500) {
  return new Response(
    `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault><faultcode>sf:INVALID_LOGIN</faultcode><faultstring>${message}</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`,
    { status, headers: { 'Content-Type': 'text/xml' } }
  );
}

type AggregateRow = {
  managerName?: string | null;
  termSheets?: number | string | null;
  Name?: string | null;
  expr0?: number | string | null;
};

function queryOk(records: Array<Record<string, unknown>> | AggregateRow[]) {
  return Response.json({ totalSize: records.length, done: true, records });
}

function mockFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  savedEnv = {};
  for (const k of SF_ENV) savedEnv[k] = process.env[k];
  process.env.SF_USERNAME = 'automation@symphonyinfra.com';
  process.env.SF_PASSWORD = 'p@ss<&>"\'';
  process.env.SF_SECURITY_TOKEN = 'TOKEN123';
  delete process.env.SF_DOMAIN;
});

afterEach(() => {
  for (const k of SF_ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Salesforce login (SOAP)', () => {
  it('posts a SOAP login with escaped username/password+token', async () => {
    const fetchMock = mockFetch(loginOk(), queryOk([]));
    await getCurrentInvestments();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://login.salesforce.com/services/Soap/u/60.0');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: 'login' });
    expect(init.body).toContain('<n1:username>automation@symphonyinfra.com</n1:username>');
    expect(init.body).toContain('<n1:password>p@ss&lt;&amp;&gt;&quot;&apos;TOKEN123</n1:password>');
  });

  it('works without a security token', async () => {
    delete process.env.SF_SECURITY_TOKEN;
    const fetchMock = mockFetch(loginOk(), queryOk([]));
    await getCurrentInvestments();
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
    const fetchMock = mockFetch(loginOk(), queryOk([]));
    await getCurrentInvestments();
    expect(fetchMock.mock.calls[0][0]).toBe(`${base}/services/Soap/u/60.0`);
  });

  it('throws when SF_USERNAME / SF_PASSWORD missing (no fetch)', async () => {
    const fetchMock = mockFetch();
    delete process.env.SF_USERNAME;
    await expect(getCurrentInvestments()).rejects.toThrow('Missing required env var: SF_USERNAME');
    process.env.SF_USERNAME = 'u';
    delete process.env.SF_PASSWORD;
    await expect(fetchTermSheetCountsFromSalesforce()).rejects.toThrow('Missing required env var: SF_PASSWORD');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces SOAP faultstring on login failure', async () => {
    mockFetch(loginFault('INVALID_LOGIN: Invalid username, password, security token; or user locked out.'));
    await expect(getCurrentInvestments()).rejects.toThrow(
      'INVALID_LOGIN: Invalid username, password, security token; or user locked out.'
    );
  });

  it('treats a 200 response containing <faultcode> as failure', async () => {
    mockFetch(loginFault('LOGIN_MUST_USE_SECURITY_TOKEN', 200));
    await expect(getCurrentInvestments()).rejects.toThrow('LOGIN_MUST_USE_SECURITY_TOKEN');
  });

  it('falls back to a status message when no faultstring', async () => {
    mockFetch(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(getCurrentInvestments()).rejects.toThrow('Salesforce login failed (502)');
  });

  it('throws when the login response lacks session details', async () => {
    mockFetch(new Response('<result><serverUrl>https://x.my.salesforce.com/a</serverUrl></result>', { status: 200 }));
    await expect(getCurrentInvestments()).rejects.toThrow(
      'Salesforce login response missing session details'
    );
  });

  it('logs in on every call (no session cache)', async () => {
    const fetchMock = mockFetch(loginOk(), queryOk([]), loginOk(), queryOk([]));
    await getCurrentInvestments();
    await fetchTermSheetCountsFromSalesforce();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[2][0])).toContain('/services/Soap/u/60.0');
  });
});

describe('Salesforce query (REST)', () => {
  it('queries the instance origin from serverUrl with the session as Bearer', async () => {
    const fetchMock = mockFetch(loginOk('https://na99.my.salesforce.com/services/Soap/u/60.0/00D'), queryOk([]));
    await getCurrentInvestments();

    const [url, init] = fetchMock.mock.calls[1];
    const u = new URL(url);
    expect(u.origin).toBe('https://na99.my.salesforce.com');
    expect(u.pathname).toBe('/services/data/v60.0/query');
    expect(init.headers).toEqual({ Authorization: 'Bearer 00Dxx!SESSION.TOKEN', Accept: 'application/json' });
  });

  it('getCurrentInvestments sends the trimmed investments SOQL and returns raw data', async () => {
    const payload = { totalSize: 1, done: true, records: [{ Id: '006A', Annual_Rent__c: 1200 }] };
    const fetchMock = mockFetch(loginOk(), Response.json(payload));
    await expect(getCurrentInvestments()).resolves.toEqual(payload);

    const soql = new URL(fetchMock.mock.calls[1][0]).searchParams.get('q')!;
    expect(soql).toBe(soql.trim());
    expect(soql).toMatch(/^SELECT Id, All_In_Purchase_Price__c, Annual_Rent__c, Source_Type__c/);
    expect(soql).toContain('FROM Opportunity');
    expect(soql).toContain('WHERE Current_Investment_Date__c > 2025-12-31');
  });

  it('fetchTermSheetCountsFromSalesforce sends the grouped proprietary term-sheet SOQL', async () => {
    const fetchMock = mockFetch(loginOk(), queryOk([]));
    await fetchTermSheetCountsFromSalesforce();
    const soql = new URL(fetchMock.mock.calls[1][0]).searchParams.get('q')!;
    expect(soql).toMatch(
      /^SELECT Acquisition_Advisor_Manager__r\.Name managerName, COUNT\(Id\) termSheets\s+FROM Opportunity/
    );
    expect(soql).toContain("WHERE Term_Sheet_Signed_Date__c = THIS_MONTH AND Source_Type__c = 'Proprietary'");
    expect(soql).toMatch(/GROUP BY Acquisition_Advisor_Manager__r\.Name$/);
    expect(soql).not.toContain('LIKE');
  });

  it('surfaces the first Salesforce error message on query failure', async () => {
    mockFetch(
      loginOk(),
      Response.json([{ message: "No such column 'Foo__c'", errorCode: 'INVALID_FIELD' }], { status: 400 })
    );
    await expect(getCurrentInvestments()).rejects.toThrow("No such column 'Foo__c'");
  });

  it('falls back to a status message on non-array error bodies', async () => {
    mockFetch(loginOk(), Response.json({ error: 'nope' }, { status: 401 }));
    await expect(fetchTermSheetCountsFromSalesforce()).rejects.toThrow('Salesforce query failed (401)');
  });

  it('reports the HTTP status when an error body is not JSON', async () => {
    mockFetch(loginOk(), new Response('<html>Service Unavailable</html>', { status: 503 }));
    await expect(getCurrentInvestments()).rejects.toThrow('Salesforce query failed (503)');
  });

  it('rejects a 200 response that is not JSON', async () => {
    mockFetch(loginOk(), new Response('<html>maintenance</html>', { status: 200 }));
    await expect(getCurrentInvestments()).rejects.toThrow('Salesforce query returned a non-JSON response');
  });
});

describe('fetchTermSheetCountsFromSalesforce', () => {
  it('maps aliased aggregate rows to { name, count }', async () => {
    mockFetch(
      loginOk(),
      queryOk([
        { managerName: 'Nick Bocchi', termSheets: 4 },
        { managerName: null, termSheets: 2 },
      ])
    );
    await expect(fetchTermSheetCountsFromSalesforce()).resolves.toEqual([
      { name: 'Nick Bocchi', count: 4 },
      { name: null, count: 2 },
    ]);
  });

  it("falls back to Salesforce's default aggregate keys (Name / expr0)", async () => {
    mockFetch(loginOk(), queryOk([{ Name: 'Ethan Sanandaji', expr0: '2' }]));
    await expect(fetchTermSheetCountsFromSalesforce()).resolves.toEqual([
      { name: 'Ethan Sanandaji', count: '2' },
    ]);
  });

  it('returns [] when the response has no records array', async () => {
    mockFetch(loginOk(), Response.json({ totalSize: 0, done: true }));
    await expect(fetchTermSheetCountsFromSalesforce()).resolves.toEqual([]);
  });
});
