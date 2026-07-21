const API_VERSION = '60.0';

const CURRENT_INVESTMENTS_QUERY = `
SELECT Id, All_In_Purchase_Price__c, Annual_Rent__c, Source_Type__c
FROM Opportunity
WHERE Current_Investment_Date__c > 2025-12-31
`;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function salesforceLoginBase() {
  const domain = (process.env.SF_DOMAIN || 'login').trim();
  if (/^https?:\/\//i.test(domain)) return domain.replace(/\/$/, '');
  if (domain === 'test') return 'https://test.salesforce.com';
  if (domain === 'login') return 'https://login.salesforce.com';
  if (domain.includes('.')) return `https://${domain.replace(/\/$/, '')}`;
  return `https://${domain}.my.salesforce.com`;
}

function getTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}>([^<]+)</${tagName}>`));
  return match ? match[1] : '';
}

async function loginToSalesforce() {
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

async function runSalesforceQuery(soql) {
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
    const message = Array.isArray(data) && data[0]?.message
      ? data[0].message
      : `Salesforce query failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

async function getCurrentInvestments() {
  return runSalesforceQuery(CURRENT_INVESTMENTS_QUERY);
}

module.exports = {
  getCurrentInvestments,
};
