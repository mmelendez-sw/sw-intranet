import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TERM_SHEET_POWERBI,
  buildTermSheetDax,
  clearTermSheetDatasetCache,
  daxResultKey,
  executeDaxQuery,
  fetchTermSheetCountsFromPowerBI,
  resolveReportDatasetId,
} from '../powerbi';

const ENV = [
  'POWERBI_TENANT_ID',
  'POWERBI_CLIENT_ID',
  'POWERBI_USERNAME',
  'POWERBI_PASSWORD',
  'POWERBI_TERM_SHEET_WORKSPACE_ID',
  'POWERBI_TERM_SHEET_REPORT_ID',
  'POWERBI_TERM_SHEET_DATASET_ID',
] as const;
let savedEnv: Record<string, string | undefined>;

const WS = TERM_SHEET_POWERBI.workspaceId;
const REPORT = TERM_SHEET_POWERBI.reportId;
const MANAGER_KEY = daxResultKey(TERM_SHEET_POWERBI.managerColumn);

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  process.env.POWERBI_TENANT_ID = 'tenant-1';
  process.env.POWERBI_CLIENT_ID = 'client-1';
  process.env.POWERBI_USERNAME = 'automation@symphonyinfra.com';
  process.env.POWERBI_PASSWORD = 'pw';
  clearTermSheetDatasetCache();
});

afterEach(() => {
  for (const k of ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
});

const aadOk = () => Response.json({ access_token: 'AAD_TOKEN', token_type: 'Bearer' });
const reportOk = (datasetId = 'ds-1') => Response.json({ id: REPORT, datasetId });
const queryOk = (rows: Array<Record<string, unknown>>) => Response.json({ results: [{ tables: [{ rows }] }] });

function mockFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('TERM_SHEET_POWERBI', () => {
  it('points at the MTD Proprietary report in the shared workspace', () => {
    expect(WS).toBe('113d281a-8fe0-4d14-829e-30bde3a28f49');
    expect(REPORT).toBe('5112761a-0830-48f3-8f47-2922949b300f');
  });
});

describe('buildTermSheetDax', () => {
  it('groups by the manager column with page filters and the MTD measure', () => {
    expect(buildTermSheetDax()).toBe(
      [
        'EVALUATE',
        'SUMMARIZECOLUMNS(',
        `  ${TERM_SHEET_POWERBI.managerColumn},`,
        ...TERM_SHEET_POWERBI.pageFilters.map((f) => `  ${f},`),
        `  "TermSheets", ${TERM_SHEET_POWERBI.countMeasure}`,
        ')',
      ].join('\n')
    );
  });

  it('works with no page filters and multiple filters', () => {
    const base = { ...TERM_SHEET_POWERBI, managerColumn: "'T'[M]", countMeasure: '[C]' };
    expect(buildTermSheetDax({ ...base, pageFilters: [] })).toBe(
      'EVALUATE\nSUMMARIZECOLUMNS(\n  \'T\'[M],\n  "TermSheets", [C]\n)'
    );
    expect(buildTermSheetDax({ ...base, pageFilters: ['F1', 'F2'] })).toBe(
      'EVALUATE\nSUMMARIZECOLUMNS(\n  \'T\'[M],\n  F1,\n  F2,\n  "TermSheets", [C]\n)'
    );
  });
});

describe('daxResultKey', () => {
  it.each([
    ["'Opportunity'[Acquisition Advisor Manager]", 'Opportunity[Acquisition Advisor Manager]'],
    ['Opportunity[Owner]', 'Opportunity[Owner]'],
    ["'Bob''s Table'[Name]", "Bob's Table[Name]"],
    ['[TermSheets]', '[TermSheets]'],
  ])('%s → %s', (ref, key) => {
    expect(daxResultKey(ref)).toBe(key);
  });
});

describe('resolveReportDatasetId', () => {
  it('reads datasetId from the workspace report and caches it', async () => {
    const fetchMock = mockFetch(reportOk('ds-9'));
    await expect(resolveReportDatasetId(WS, REPORT, 'TOKEN')).resolves.toBe('ds-9');
    await expect(resolveReportDatasetId(WS, REPORT, 'TOKEN')).resolves.toBe('ds-9');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.powerbi.com/v1.0/myorg/groups/${WS}/reports/${REPORT}`);
    expect(init.headers).toEqual({ Authorization: 'Bearer TOKEN' });
  });

  it('surfaces the Power BI error (e.g. no access to the workspace)', async () => {
    mockFetch(Response.json({ error: { code: 'ItemNotFound', message: 'Report not found' } }, { status: 404 }));
    await expect(resolveReportDatasetId(WS, REPORT, 'TOKEN')).rejects.toThrow('Report not found');
  });

  it('falls back to a status message', async () => {
    mockFetch(new Response('nope', { status: 403 }));
    await expect(resolveReportDatasetId(WS, REPORT, 'TOKEN')).rejects.toThrow(
      `Failed to load Power BI report ${REPORT} (403)`
    );
  });
});

describe('executeDaxQuery', () => {
  it('POSTs the query to the workspace dataset and returns the first table rows', async () => {
    const fetchMock = mockFetch(queryOk([{ a: 1 }]));
    await expect(executeDaxQuery(WS, 'ds-1', 'EVALUATE X', 'TOKEN')).resolves.toEqual([{ a: 1 }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.powerbi.com/v1.0/myorg/groups/${WS}/datasets/ds-1/executeQueries`);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer TOKEN', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      queries: [{ query: 'EVALUATE X' }],
      serializerSettings: { includeNulls: true },
    });
  });

  it('uses the My Workspace path for "me"', async () => {
    const fetchMock = mockFetch(queryOk([]));
    await executeDaxQuery('me', 'ds-1', 'EVALUATE X', 'TOKEN');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.powerbi.com/v1.0/myorg/datasets/ds-1/executeQueries');
  });

  it('gets its own AAD token when none is passed', async () => {
    const fetchMock = mockFetch(aadOk(), queryOk([]));
    await executeDaxQuery(WS, 'ds-1', 'EVALUATE X');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer AAD_TOKEN');
  });

  it('returns [] when there are no tables', async () => {
    mockFetch(Response.json({ results: [{}] }));
    await expect(executeDaxQuery(WS, 'ds-1', 'EVALUATE X', 'T')).resolves.toEqual([]);
  });

  it('surfaces the DAX error detail on a 400', async () => {
    mockFetch(
      Response.json(
        {
          error: {
            code: 'DatasetExecuteQueriesError',
            'pbi.error': { details: [{ detail: { value: "Column 'Source Type' cannot be found." } }] },
          },
        },
        { status: 400 }
      )
    );
    await expect(executeDaxQuery(WS, 'ds-1', 'EVALUATE X', 'T')).rejects.toThrow(
      "Column 'Source Type' cannot be found."
    );
  });

  it('surfaces a per-query error on a 200', async () => {
    mockFetch(Response.json({ results: [{ error: { message: 'Query timeout' } }] }));
    await expect(executeDaxQuery(WS, 'ds-1', 'EVALUATE X', 'T')).rejects.toThrow('Query timeout');
  });

  it('falls back to a status message for non-JSON errors', async () => {
    mockFetch(new Response('<html/>', { status: 401 }));
    await expect(executeDaxQuery(WS, 'ds-1', 'EVALUATE X', 'T')).rejects.toThrow(
      'Power BI executeQueries failed (401)'
    );
  });
});

describe('fetchTermSheetCountsFromPowerBI', () => {
  it('resolves the dataset from the report, runs the DAX, and maps rows', async () => {
    const fetchMock = mockFetch(
      aadOk(),
      reportOk('ds-7'),
      queryOk([
        { [MANAGER_KEY]: 'Nick Bocchi', '[TermSheets]': 3 },
        { [MANAGER_KEY]: null, '[TermSheets]': 1 },
        { [MANAGER_KEY]: 'Shawn Casey' },
      ])
    );

    await expect(fetchTermSheetCountsFromPowerBI()).resolves.toEqual([
      { name: 'Nick Bocchi', count: 3 },
      { name: null, count: 1 },
      { name: 'Shawn Casey', count: null },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [queryUrl, queryInit] = fetchMock.mock.calls[2];
    expect(queryUrl).toBe(`https://api.powerbi.com/v1.0/myorg/groups/${WS}/datasets/ds-7/executeQueries`);
    expect(JSON.parse(queryInit.body).queries[0].query).toBe(buildTermSheetDax());
  });

  it('skips the report lookup when POWERBI_TERM_SHEET_DATASET_ID is set', async () => {
    process.env.POWERBI_TERM_SHEET_DATASET_ID = ' ds-env ';
    const fetchMock = mockFetch(aadOk(), queryOk([]));
    await fetchTermSheetCountsFromPowerBI();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('/datasets/ds-env/executeQueries');
  });

  it('honors workspace / report env overrides', async () => {
    process.env.POWERBI_TERM_SHEET_WORKSPACE_ID = 'ws-x';
    process.env.POWERBI_TERM_SHEET_REPORT_ID = 'rep-x';
    const fetchMock = mockFetch(aadOk(), reportOk('ds-x'), queryOk([]));
    await fetchTermSheetCountsFromPowerBI();
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.powerbi.com/v1.0/myorg/groups/ws-x/reports/rep-x');
    expect(fetchMock.mock.calls[2][0]).toBe(
      'https://api.powerbi.com/v1.0/myorg/groups/ws-x/datasets/ds-x/executeQueries'
    );
  });

  it('propagates AAD sign-in failures', async () => {
    mockFetch(Response.json({ error: 'invalid_grant', error_description: 'AADSTS50126' }, { status: 400 }));
    await expect(fetchTermSheetCountsFromPowerBI()).rejects.toThrow('AADSTS50126');
  });
});
