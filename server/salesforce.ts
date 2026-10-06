const API_VERSION = '60.0';

const CURRENT_INVESTMENTS_QUERY = `
SELECT Id, All_In_Purchase_Price__c, Annual_Rent__c, Source_Type__c
FROM Opportunity
WHERE Current_Investment_Date__c > 2025-12-31
`;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

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

  const response = await fetch(loginUrl, {
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

async function runSalesforceQuery(soql: string): Promise<unknown> {
  const { sessionId, instanceUrl } = await loginToSalesforce();
  const queryUrl = `${instanceUrl}/services/data/v${API_VERSION}/query?q=${encodeURIComponent(soql.trim())}`;

  const response = await fetch(queryUrl, {
    headers: {
      Authorization: `Bearer ${sessionId}`,
      Accept: 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    const message =
      Array.isArray(data) && data[0]?.message
        ? data[0].message
        : `Salesforce query failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export async function getCurrentInvestments(): Promise<unknown> {
  return runSalesforceQuery(CURRENT_INVESTMENTS_QUERY);
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

/** Counts change only when a term sheet is signed; avoid a Salesforce login per page view. */
const TERM_SHEET_CACHE_MS = 5 * 60_000;
let termSheetCache: { at: number; value: { monthLabel: string; counts: TermSheetCountRow[] } } | null =
  null;

/**
 * Monthly Term Sheet Leaderboard: THIS_MONTH proprietary term sheets per Acquisition
 * Advisor Manager. Only managers with at least one term sheet are returned.
 */
export async function getTermSheetRankings(): Promise<{
  monthLabel: string;
  counts: TermSheetCountRow[];
}> {
  if (termSheetCache && Date.now() - termSheetCache.at < TERM_SHEET_CACHE_MS) {
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

  const monthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const value = { monthLabel, counts };
  termSheetCache = { at: Date.now(), value };
  return value;
}
