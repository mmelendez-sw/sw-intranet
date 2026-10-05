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

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Gateway / maintenance pages come back as HTML.
    if (!response.ok) throw new Error(`Salesforce query failed (${response.status})`);
    throw new Error('Salesforce query returned a non-JSON response');
  }
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
 * Fixed AM roster for Monthly Term Sheet Rankings. `displayName` must equal the
 * Salesforce User Name on Acquisition_Advisor_Manager__c (compared case-insensitively).
 */
export const TERM_SHEET_RANKING_ROSTER: Array<{
  email: string;
  matchKey: string;
  displayName: string;
}> = [
  { email: 'BSeidenberg@symphonyinfra.com', matchKey: 'Seidenberg', displayName: 'Brandon Seidenberg' },
  { email: 'CPolidoro@symphonyinfra.com', matchKey: 'Polidoro', displayName: 'Chris Polidoro' },
  { email: 'DKing@symphonyinfra.com', matchKey: 'King', displayName: 'Dylan King' },
  { email: 'esanandaji@symphonyinfra.com', matchKey: 'Sanandaji', displayName: 'Ethan Sanandaji' },
  { email: 'mkossak@symphonyinfra.com', matchKey: 'Kossak', displayName: 'Michael Kossak' },
  { email: 'NBocchi@symphonyinfra.com', matchKey: 'Bocchi', displayName: 'Nick Bocchi' },
  { email: 'scasey@symphonyinfra.com', matchKey: 'Casey', displayName: 'Shawn Casey' },
  { email: 'SSchamberg@symphonyinfra.com', matchKey: 'Schamberg', displayName: 'Steve Schamberg' },
];

/** Proprietary term sheets signed this month, counted per Acquisition Advisor Manager. */
const TERM_SHEET_RANKINGS_QUERY = `
SELECT Acquisition_Advisor_Manager__r.Name managerName, COUNT(Id) termSheets
FROM Opportunity
WHERE Term_Sheet_Signed_Date__c = THIS_MONTH AND Source_Type__c = 'Proprietary'
GROUP BY Acquisition_Advisor_Manager__r.Name
`;

export type TermSheetTier = 0 | 1 | 2 | 3;

export type TermSheetRankingRow = {
  email: string;
  displayName: string;
  matchKey: string;
  count: number;
  tier: TermSheetTier;
  dealSourceLabel: string | null;
};

function tierForCount(count: number): TermSheetTier {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** AggregateResult row. Aliases are set in the SOQL; Salesforce's defaults are the fallback. */
type TermSheetAggregateRecord = {
  managerName?: string | null;
  termSheets?: number | string | null;
  Name?: string | null;
  expr0?: number | string | null;
};

type SalesforceQueryResult = {
  records?: TermSheetAggregateRecord[];
  totalSize?: number;
};

/**
 * Monthly Term Sheet Rankings: proprietary term sheets signed THIS_MONTH per
 * Acquisition Advisor Manager, always returning the full fixed roster (zeros included).
 * Managers not on the roster are returned in `unmatchedManagers` so name mismatches
 * between Salesforce and the roster are visible instead of silently dropped.
 */
export async function getTermSheetRankings(): Promise<{
  monthLabel: string;
  rankings: TermSheetRankingRow[];
  unmatchedManagers: Array<{ name: string; count: number }>;
}> {
  const data = (await runSalesforceQuery(TERM_SHEET_RANKINGS_QUERY)) as SalesforceQueryResult;
  const counts = new Map<string, { count: number; dealSourceLabel: string | null }>();
  const rosterByName = new Map(
    TERM_SHEET_RANKING_ROSTER.map((entry) => [normalizeName(entry.displayName), entry])
  );
  const unmatchedManagers: Array<{ name: string; count: number }> = [];

  for (const entry of TERM_SHEET_RANKING_ROSTER) {
    counts.set(entry.matchKey, { count: 0, dealSourceLabel: null });
  }

  for (const record of data?.records || []) {
    const name = String(record.managerName ?? record.Name ?? '').trim();
    const rawCount = Number(record.termSheets ?? record.expr0);
    const count = Number.isFinite(rawCount) ? Math.max(0, Math.trunc(rawCount)) : 0;
    if (!count) continue;

    const matched = name ? rosterByName.get(normalizeName(name)) : undefined;
    if (!matched) {
      // Includes opportunities with no manager set (name === '').
      unmatchedManagers.push({ name: name || '(no manager)', count });
      continue;
    }
    const prev = counts.get(matched.matchKey) || { count: 0, dealSourceLabel: null };
    counts.set(matched.matchKey, {
      count: prev.count + count,
      dealSourceLabel: prev.dealSourceLabel || name,
    });
  }

  const rankings = TERM_SHEET_RANKING_ROSTER.map((entry) => {
    const stats = counts.get(entry.matchKey) || { count: 0, dealSourceLabel: null };
    return {
      email: entry.email,
      displayName: entry.displayName,
      matchKey: entry.matchKey,
      count: stats.count,
      tier: tierForCount(stats.count),
      dealSourceLabel: stats.dealSourceLabel,
    };
  }).sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));

  const monthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  return { monthLabel, rankings, unmatchedManagers };
}
