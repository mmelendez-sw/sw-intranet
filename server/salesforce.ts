import { requireEnv } from './env';
import { fetchWithTimeout } from './fetchWithTimeout';

const API_VERSION = '60.0';

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function salesforceLoginBase(): string {
  const domain = (process.env.SF_DOMAIN || 'login').trim();
  if (/^https?:\/\//i.test(domain)) return domain.replace(/\/$/, '');
  if (domain === 'test') return 'https://test.salesforce.com';
  if (domain === 'login') return 'https://login.salesforce.com';
  if (domain.includes('.')) return `https://${domain.replace(/\/$/, '')}`;
  return `https://${domain}.my.salesforce.com`;
}

function getTag(xml: string, tagName: string): string {
  const match = xml.match(new RegExp(`<${tagName}>([^<]+)</${tagName}>`));
  return match ? match[1] : '';
}

async function loginToSalesforce(): Promise<{ sessionId: string; instanceUrl: string }> {
  const username = requireEnv('SF_USERNAME');
  const password = requireEnv('SF_PASSWORD');
  const securityToken = process.env.SF_SECURITY_TOKEN || '';
  const loginUrl = `${salesforceLoginBase()}/services/Soap/u/${API_VERSION}`;

  const body = `<?xml version="1.0" encoding="utf-8" ?>
<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Body>
    <n1:login xmlns:n1="urn:partner.soap.sforce.com">
      <n1:username>${escapeXml(username)}</n1:username>
      <n1:password>${escapeXml(password + securityToken)}</n1:password>
    </n1:login>
  </env:Body>
</env:Envelope>`;

  const response = await fetchWithTimeout(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=UTF-8',
      SOAPAction: 'login',
    },
    body,
  });

  const text = await response.text();
  if (!response.ok || text.includes('<faultcode>')) {
    const message = getTag(text, 'faultstring') || `Salesforce login failed (${response.status})`;
    throw new Error(message);
  }

  const sessionId = getTag(text, 'sessionId');
  const serverUrl = getTag(text, 'serverUrl');
  if (!sessionId || !serverUrl) {
    throw new Error('Salesforce login response missing session details');
  }

  return {
    sessionId,
    instanceUrl: new URL(serverUrl).origin,
  };
}

type SalesforceSession = { sessionId: string; instanceUrl: string };

/** SOAP sessions last hours; reuse one across warm invocations instead of logging in per query. */
let sessionCache: SalesforceSession | null = null;
let loginInFlight: Promise<SalesforceSession> | null = null;

function getSalesforceSession(): Promise<SalesforceSession> {
  if (sessionCache) return Promise.resolve(sessionCache);
  if (!loginInFlight) {
    loginInFlight = loginToSalesforce()
      .then((session) => {
        sessionCache = session;
        return session;
      })
      .finally(() => {
        loginInFlight = null;
      });
  }
  return loginInFlight;
}

class SalesforceSessionExpiredError extends Error {}

async function querySalesforce(session: SalesforceSession, soql: string): Promise<unknown> {
  const queryUrl = `${session.instanceUrl}/services/data/v${API_VERSION}/query?q=${encodeURIComponent(soql.trim())}`;

  const response = await fetchWithTimeout(queryUrl, {
    headers: {
      Authorization: `Bearer ${session.sessionId}`,
      Accept: 'application/json',
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const first = Array.isArray(data) ? data[0] : null;
    if (response.status === 401 || first?.errorCode === 'INVALID_SESSION_ID') {
      throw new SalesforceSessionExpiredError('Salesforce session expired');
    }
    throw new Error(first?.message || `Salesforce query failed (${response.status})`);
  }

  return data;
}

async function runSalesforceQuery(soql: string): Promise<unknown> {
  const session = await getSalesforceSession();
  try {
    return await querySalesforce(session, soql);
  } catch (err) {
    if (!(err instanceof SalesforceSessionExpiredError)) throw err;
    // Session expired or was revoked: log in again once and retry.
    if (sessionCache === session) sessionCache = null;
    return querySalesforce(await getSalesforceSession(), soql);
  }
}

/**
 * Proprietary term sheets signed this month, grouped by Acquisition Advisor Manager.
 * Names are matched to Entra "Acquisitions Manager" users client-side.
 */
const TERM_SHEET_RANKINGS_QUERY = `
SELECT Acquisition_Advisor_Manager__r.Name, COUNT(Id)
FROM Opportunity
WHERE Term_Sheet_Signed_Date__c = THIS_MONTH
AND Source_Type__c = 'Proprietary'
GROUP BY Acquisition_Advisor_Manager__r.Name
`;

export type TermSheetCountRow = {
  name: string;
  count: number;
};

type TermSheetAggregateResult = {
  records?: Array<{
    // Aggregate results flatten relationship fields; tolerate the nested shape too.
    Name?: string | null;
    Acquisition_Advisor_Manager__r?: { Name?: string | null } | null;
    expr0?: number;
  }>;
};

/** Counts change only when a term sheet is signed; avoid a Salesforce query per page view. */
const TERM_SHEET_CACHE_MS = 5 * 60_000;
let termSheetCache: { at: number; value: { monthLabel: string; counts: TermSheetCountRow[] } } | null =
  null;

/** SOQL THIS_MONTH follows the org's timezone, so the month label must too. */
const DEFAULT_ORG_TIME_ZONE = 'America/New_York';
let orgTimeZone: string | null = null;

function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

async function getOrgTimeZone(): Promise<string> {
  if (orgTimeZone) return orgTimeZone;
  try {
    const data = (await runSalesforceQuery('SELECT TimeZoneSidKey FROM Organization')) as {
      records?: Array<{ TimeZoneSidKey?: string | null }>;
    };
    const tz = data.records?.[0]?.TimeZoneSidKey || '';
    orgTimeZone = tz && isSupportedTimeZone(tz) ? tz : DEFAULT_ORG_TIME_ZONE;
    return orgTimeZone;
  } catch (err) {
    // Transient failure: use the default for now and look it up again next time.
    console.warn('[salesforce] org timezone lookup failed', err);
    return DEFAULT_ORG_TIME_ZONE;
  }
}

/**
 * Monthly Term Sheet Leaderboard: THIS_MONTH proprietary term sheets per Acquisition
 * Advisor Manager. Only managers with at least one term sheet are returned.
 */
export async function getTermSheetRankings(): Promise<{
  monthLabel: string;
  counts: TermSheetCountRow[];
}> {
  const timeZone = await getOrgTimeZone();
  const monthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone });
  // Same month only: a cached count must not straddle a month rollover.
  if (
    termSheetCache &&
    termSheetCache.value.monthLabel === monthLabel &&
    Date.now() - termSheetCache.at < TERM_SHEET_CACHE_MS
  ) {
    return termSheetCache.value;
  }

  const data = (await runSalesforceQuery(TERM_SHEET_RANKINGS_QUERY)) as TermSheetAggregateResult;
  const counts: TermSheetCountRow[] = [];
  for (const record of data.records || []) {
    const name = (record.Name ?? record.Acquisition_Advisor_Manager__r?.Name ?? '').trim();
    const count = Number(record.expr0) || 0;
    if (!name || count <= 0) continue;
    counts.push({ name, count });
  }
  counts.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const value = { monthLabel, counts };
  termSheetCache = { at: Date.now(), value };
  return value;
}
