import type { ManagerTermSheetCount } from './termSheetRankings';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function isMyWorkspace(workspaceId?: string): boolean {
  return !workspaceId || ['me', 'my', 'personal'].includes(String(workspaceId).toLowerCase());
}

/**
 * Sign in as the automation user (ROPC) — same idea as scripts/powerbi_refresh.py.
 * Powers auto SSO for the homepage embed (viewers don't sign into Power BI).
 */
async function getAadAccessToken(): Promise<string> {
  const tenantId = requireEnv('POWERBI_TENANT_ID');
  const clientId = requireEnv('POWERBI_CLIENT_ID');
  const username = requireEnv('POWERBI_USERNAME');
  const password = requireEnv('POWERBI_PASSWORD');

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    username,
    password,
    scope: [
      'https://analysis.windows.net/powerbi/api/Report.Read.All',
      'https://analysis.windows.net/powerbi/api/Dataset.Read.All',
      'offline_access',
    ].join(' '),
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `Azure AD ROPC token request failed (${response.status})`
    );
  }

  return data.access_token;
}

function reportApiPath(workspaceId: string, reportId: string): string {
  if (isMyWorkspace(workspaceId)) return `/reports/${reportId}`;
  return `/groups/${workspaceId}/reports/${reportId}`;
}

function generateTokenPath(workspaceId: string, reportId: string): string {
  if (isMyWorkspace(workspaceId)) return `/reports/${reportId}/GenerateToken`;
  return `/groups/${workspaceId}/reports/${reportId}/GenerateToken`;
}

export interface PowerbiEmbedConfig {
  reportId: string;
  embedUrl: string;
  token: string;
  tokenType: 'Embed' | 'Aad';
  expiration: string;
}

/**
 * Auto SSO embed config:
 * 1) Sign in as Salesforceautomation (ROPC)
 * 2) Load report embedUrl from My Workspace (or configured workspace)
 * 3) Prefer GenerateToken; fall back to AAD user token (TokenType.Aad)
 */
export async function getEmbedConfig(reportId?: string): Promise<PowerbiEmbedConfig> {
  const workspaceId = (process.env.POWERBI_WORKSPACE_ID || 'me').trim();
  const resolvedReportId = reportId || requireEnv('POWERBI_REPORT_ID');
  const accessToken = await getAadAccessToken();

  const reportResponse = await fetch(
    `https://api.powerbi.com/v1.0/myorg${reportApiPath(workspaceId, resolvedReportId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const report = (await reportResponse.json()) as {
    id?: string;
    embedUrl?: string;
    error?: { message?: string };
  };
  if (!reportResponse.ok || !report.id || !report.embedUrl) {
    throw new Error(
      report.error?.message || `Failed to load Power BI report (${reportResponse.status})`
    );
  }

  const tokenResponse = await fetch(
    `https://api.powerbi.com/v1.0/myorg${generateTokenPath(workspaceId, resolvedReportId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessLevel: 'View' }),
    }
  );

  const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as {
    token?: string;
    expiration?: string;
  };
  if (tokenResponse.ok && tokenPayload.token) {
    return {
      reportId: report.id,
      embedUrl: report.embedUrl,
      token: tokenPayload.token,
      tokenType: 'Embed',
      expiration: tokenPayload.expiration || '',
    };
  }

  // Viewer-only accounts often can't GenerateToken; AAD token still embeds as that user.
  return {
    reportId: report.id,
    embedUrl: report.embedUrl,
    token: accessToken,
    tokenType: 'Aad',
    expiration: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
  };
}

// ── Term Sheet Leaderboard (DAX executeQueries) ─────────────────────────────

/**
 * Source of the leaderboard counts: the "MTD Proprietary" page (section
 * f36508456d02bff60b47) of report 5112761a-… in workspace 113d281a-….
 * The REST API can't read a page directly, so the DAX below reproduces that page's
 * visual against the report's dataset: same measure, same page filters.
 *
 * TODO: replace managerColumn / countMeasure / pageFilters with the real ones. Easiest:
 * Power BI Desktop → View → Performance analyzer → refresh the MTD Proprietary visual →
 * "Copy query", and take the grouping column, measure, and filters from it.
 *
 * Env overrides (optional): POWERBI_TERM_SHEET_WORKSPACE_ID, POWERBI_TERM_SHEET_REPORT_ID,
 * POWERBI_TERM_SHEET_DATASET_ID (skips the report → dataset lookup).
 */
export const TERM_SHEET_POWERBI = {
  workspaceId: '113d281a-8fe0-4d14-829e-30bde3a28f49',
  reportId: '5112761a-0830-48f3-8f47-2922949b300f',
  /** Column the visual groups by (one row per manager). */
  managerColumn: "'Opportunity'[Acquisition Advisor Manager]",
  /** The page's month-to-date measure. */
  countMeasure: '[MTD Term Sheets]',
  /** Page / visual filters, as DAX filter tables. */
  pageFilters: ["TREATAS({\"Proprietary\"}, 'Opportunity'[Source Type])"],
};

type TermSheetPowerBIConfig = typeof TERM_SHEET_POWERBI;

/** EVALUATE SUMMARIZECOLUMNS(manager, filters…, "TermSheets", measure). */
export function buildTermSheetDax(config: TermSheetPowerBIConfig = TERM_SHEET_POWERBI): string {
  return [
    'EVALUATE',
    'SUMMARIZECOLUMNS(',
    ...[config.managerColumn, ...config.pageFilters, `"TermSheets", ${config.countMeasure}`].map(
      (arg, i, all) => `  ${arg}${i < all.length - 1 ? ',' : ''}`
    ),
    ')',
  ].join('\n');
}

/** executeQueries returns `'Opportunity'[Name]` columns keyed as `Opportunity[Name]`. */
export function daxResultKey(columnRef: string): string {
  const match = columnRef.trim().match(/^'?(.*?)'?\[(.+)\]$/);
  if (!match) return columnRef.trim();
  return `${match[1].replace(/''/g, "'")}[${match[2]}]`;
}

function datasetApiPath(workspaceId: string, datasetId: string): string {
  if (isMyWorkspace(workspaceId)) return `/datasets/${datasetId}`;
  return `/groups/${workspaceId}/datasets/${datasetId}`;
}

type PowerBIErrorBody = {
  error?: { message?: string; code?: string; 'pbi.error'?: { details?: Array<{ detail?: { value?: string } }> } };
};

type ExecuteQueriesResponse = PowerBIErrorBody & {
  results?: Array<{
    tables?: Array<{ rows?: Array<Record<string, unknown>> }>;
    error?: { message?: string };
  }>;
};

function powerBIErrorMessage(data: PowerBIErrorBody, fallback: string): string {
  const detail = data.error?.['pbi.error']?.details?.find((d) => d.detail?.value)?.detail?.value;
  return detail || data.error?.message || data.error?.code || fallback;
}

/** Run one DAX query against a dataset and return the first table's rows. */
export async function executeDaxQuery(
  workspaceId: string,
  datasetId: string,
  dax: string,
  accessToken?: string
): Promise<Array<Record<string, unknown>>> {
  const token = accessToken || (await getAadAccessToken());
  const response = await fetch(
    `https://api.powerbi.com/v1.0/myorg${datasetApiPath(workspaceId, datasetId)}/executeQueries`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: [{ query: dax }], serializerSettings: { includeNulls: true } }),
    }
  );

  const data = (await response.json().catch(() => ({}))) as ExecuteQueriesResponse;
  const result = data.results?.[0];
  if (!response.ok || result?.error) {
    throw new Error(
      result?.error?.message ||
        powerBIErrorMessage(data, `Power BI executeQueries failed (${response.status})`)
    );
  }
  return result?.tables?.[0]?.rows || [];
}

const datasetIdByReport = new Map<string, string>();

/** Test hook. */
export function clearTermSheetDatasetCache(): void {
  datasetIdByReport.clear();
}

/** Dataset behind a report (cached per workspace + report for the life of the Lambda). */
export async function resolveReportDatasetId(
  workspaceId: string,
  reportId: string,
  accessToken: string
): Promise<string> {
  const key = `${workspaceId}/${reportId}`;
  const cached = datasetIdByReport.get(key);
  if (cached) return cached;

  const response = await fetch(`https://api.powerbi.com/v1.0/myorg${reportApiPath(workspaceId, reportId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json().catch(() => ({}))) as PowerBIErrorBody & { datasetId?: string };
  if (!response.ok || !data.datasetId) {
    throw new Error(powerBIErrorMessage(data, `Failed to load Power BI report ${reportId} (${response.status})`));
  }
  datasetIdByReport.set(key, data.datasetId);
  return data.datasetId;
}

/** Month-to-date proprietary term-sheet counts per manager, as shown on the MTD Proprietary page. */
export async function fetchTermSheetCountsFromPowerBI(): Promise<ManagerTermSheetCount[]> {
  const workspaceId = (process.env.POWERBI_TERM_SHEET_WORKSPACE_ID || TERM_SHEET_POWERBI.workspaceId).trim();
  const reportId = (process.env.POWERBI_TERM_SHEET_REPORT_ID || TERM_SHEET_POWERBI.reportId).trim();
  const accessToken = await getAadAccessToken();
  const datasetId =
    process.env.POWERBI_TERM_SHEET_DATASET_ID?.trim() ||
    (await resolveReportDatasetId(workspaceId, reportId, accessToken));

  const rows = await executeDaxQuery(workspaceId, datasetId, buildTermSheetDax(), accessToken);
  const managerKey = daxResultKey(TERM_SHEET_POWERBI.managerColumn);
  return rows.map((row) => ({
    name: (row[managerKey] as string | null | undefined) ?? null,
    count: (row['[TermSheets]'] as number | string | null | undefined) ?? null,
  }));
}
