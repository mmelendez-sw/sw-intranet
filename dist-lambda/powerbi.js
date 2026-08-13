function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function isMyWorkspace(workspaceId) {
  return !workspaceId || ['me', 'my', 'personal'].includes(String(workspaceId).toLowerCase());
}

/**
 * Sign in as the automation user (ROPC) — same idea as scripts/powerbi_refresh.py.
 * This is what powers auto SSO for the homepage embed (viewers don't sign into Power BI).
 */
async function getAadAccessToken() {
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
    // Explicit scopes (works better for public-client ROPC than .default)
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

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `Azure AD ROPC token request failed (${response.status})`
    );
  }

  return data.access_token;
}

function reportApiPath(workspaceId, reportId) {
  if (isMyWorkspace(workspaceId)) return `/reports/${reportId}`;
  return `/groups/${workspaceId}/reports/${reportId}`;
}

function generateTokenPath(workspaceId, reportId) {
  if (isMyWorkspace(workspaceId)) return `/reports/${reportId}/GenerateToken`;
  return `/groups/${workspaceId}/reports/${reportId}/GenerateToken`;
}

/**
 * Auto SSO embed config:
 * 1) Sign in as Salesforceautomation
 * 2) Load report embedUrl from My Workspace (or configured workspace)
 * 3) Prefer GenerateToken; fall back to AAD user token (TokenType.Aad)
 *
 * No shared-workspace URL required when the report is in this account's My Workspace.
 */
async function getEmbedConfig(reportId) {
  const workspaceId = (process.env.POWERBI_WORKSPACE_ID || 'me').trim();
  const resolvedReportId = reportId || requireEnv('POWERBI_REPORT_ID');
  const accessToken = await getAadAccessToken();

  const reportResponse = await fetch(
    `https://api.powerbi.com/v1.0/myorg${reportApiPath(workspaceId, resolvedReportId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const report = await reportResponse.json();
  if (!reportResponse.ok) {
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

  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  if (tokenResponse.ok && tokenPayload.token) {
    return {
      reportId: report.id,
      embedUrl: report.embedUrl,
      token: tokenPayload.token,
      tokenType: 'Embed',
      expiration: tokenPayload.expiration,
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

module.exports = {
  getEmbedConfig,
};
