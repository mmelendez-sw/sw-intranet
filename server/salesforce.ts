import type { ManagerTermSheetCount } from './termSheetRankings';

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

/** Proprietary term sheets signed this month, counted per Acquisition Advisor Manager. */
const TERM_SHEET_RANKINGS_QUERY = `
SELECT Acquisition_Advisor_Manager__r.Name managerName, COUNT(Id) termSheets
FROM Opportunity
WHERE Term_Sheet_Signed_Date__c = THIS_MONTH AND Source_Type__c = 'Proprietary'
GROUP BY Acquisition_Advisor_Manager__r.Name
`;

/** AggregateResult row. Aliases are set in the SOQL; Salesforce's defaults are the fallback. */
type TermSheetAggregateRecord = {
  managerName?: string | null;
  termSheets?: number | string | null;
  Name?: string | null;
  expr0?: number | string | null;
};

/** THIS_MONTH (Salesforce org timezone) proprietary term-sheet counts per manager. */
export async function fetchTermSheetCountsFromSalesforce(): Promise<ManagerTermSheetCount[]> {
  const data = (await runSalesforceQuery(TERM_SHEET_RANKINGS_QUERY)) as {
    records?: TermSheetAggregateRecord[];
  } | null;
  return (data?.records || []).map((record) => ({
    name: record.managerName ?? record.Name ?? null,
    count: record.termSheets ?? record.expr0 ?? null,
  }));
}
