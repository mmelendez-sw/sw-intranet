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

/** Fixed AM roster for Monthly Term Sheet Rankings (match key → email). */
export const TERM_SHEET_RANKING_ROSTER: Array<{
  email: string;
  matchKey: string;
  displayName: string;
}> = [
  { email: 'BSeidenberg@symphonyinfra.com', matchKey: 'Seidenberg', displayName: 'B. Seidenberg' },
  { email: 'CPolidoro@symphonyinfra.com', matchKey: 'Polidoro', displayName: 'C. Polidoro' },
  { email: 'DHall@symphonyinfra.com', matchKey: 'Hall', displayName: 'D. Hall' },
  { email: 'DKing@symphonyinfra.com', matchKey: 'King', displayName: 'D. King' },
  { email: 'esanandaji@symphonyinfra.com', matchKey: 'Sanandaji', displayName: 'E. Sanandaji' },
  { email: 'mkossak@symphonyinfra.com', matchKey: 'Kossak', displayName: 'M. Kossak' },
  { email: 'NBocchi@symphonyinfra.com', matchKey: 'Bocchi', displayName: 'N. Bocchi' },
  { email: 'scasey@symphonyinfra.com', matchKey: 'Casey', displayName: 'S. Casey' },
  { email: 'SSchamberg@symphonyinfra.com', matchKey: 'Schamberg', displayName: 'S. Schamberg' },
];

const TERM_SHEET_RANKINGS_QUERY = `
SELECT Deal_Source_Individual__c, Id
FROM Opportunity
WHERE Term_Sheet_Signed_Date__c = THIS_MONTH
AND Deal_Source_Individual_Internal__c != null
AND (
    Deal_Source_Individual__c LIKE '%Seidenberg%'
    OR Deal_Source_Individual__c LIKE '%Polidoro%'
    OR Deal_Source_Individual__c LIKE '%Hall%'
    OR Deal_Source_Individual__c LIKE '%King%'
    OR Deal_Source_Individual__c LIKE '%Sanandaji%'
    OR Deal_Source_Individual__c LIKE '%Kossak%'
    OR Deal_Source_Individual__c LIKE '%Bocchi%'
    OR Deal_Source_Individual__c LIKE '%Casey%'
    OR Deal_Source_Individual__c LIKE '%Schamberg%'
)
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

function matchRosterEntry(dealSource: string) {
  const normalized = dealSource.toLowerCase();
  // Prefer longer / more specific keys first to avoid accidental overlaps.
  const sorted = [...TERM_SHEET_RANKING_ROSTER].sort(
    (a, b) => b.matchKey.length - a.matchKey.length
  );
  return sorted.find((entry) => normalized.includes(entry.matchKey.toLowerCase())) || null;
}

type SalesforceQueryResult = {
  records?: Array<{
    Id?: string;
    Deal_Source_Individual__c?: string | null;
  }>;
  totalSize?: number;
};

/**
 * Monthly Term Sheet Rankings: count THIS_MONTH signed term sheets per AM,
 * always returning the full fixed roster (zeros included).
 */
export async function getTermSheetRankings(): Promise<{
  monthLabel: string;
  rankings: TermSheetRankingRow[];
}> {
  const data = (await runSalesforceQuery(TERM_SHEET_RANKINGS_QUERY)) as SalesforceQueryResult;
  const counts = new Map<string, { count: number; dealSourceLabel: string | null }>();

  for (const entry of TERM_SHEET_RANKING_ROSTER) {
    counts.set(entry.matchKey, { count: 0, dealSourceLabel: null });
  }

  for (const record of data.records || []) {
    const label = (record.Deal_Source_Individual__c || '').trim();
    if (!label) continue;
    const matched = matchRosterEntry(label);
    if (!matched) continue;
    const prev = counts.get(matched.matchKey) || { count: 0, dealSourceLabel: null };
    counts.set(matched.matchKey, {
      count: prev.count + 1,
      dealSourceLabel: prev.dealSourceLabel || label,
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
  return { monthLabel, rankings };
}
