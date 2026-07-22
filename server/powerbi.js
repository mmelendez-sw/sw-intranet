function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/**
 * ROPC (username/password) — Node equivalent of:
 *   msal.PublicClientApplication(...).acquire_token_by_username_password(...)
 *
 * Requires a public/native app registration with "Allow public client flows" enabled,
 * and an account without MFA (or MFA exempt for this flow).
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
    scope: 'https://analysis.windows.net/powerbi/api/.default',
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

/**
 * Use the automation account token to fetch the report and mint an embed token.
 */
async function getEmbedConfig(reportId) {
  const workspaceId = requireEnv('POWERBI_WORKSPACE_ID');
  const resolvedReportId = reportId || requireEnv('POWERBI_REPORT_ID');
  const accessToken = await getAadAccessToken();

  const reportResponse = await fetch(
    `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${resolvedReportId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const report = await reportResponse.json();
  if (!reportResponse.ok) {
    throw new Error(
      report.error?.message || `Failed to load Power BI report (${reportResponse.status})`
    );
  }

  const tokenResponse = await fetch(
    `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${resolvedReportId}/GenerateToken`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessLevel: 'View' }),
    }
  );

  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenPayload.token) {
    // Fallback: embed with the AAD user token directly (TokenType.Aad on the client)
    if (report.embedUrl && accessToken) {
      return {
        reportId: report.id,
        embedUrl: report.embedUrl,
        token: accessToken,
        tokenType: 'Aad',
        expiration: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
      };
    }

    throw new Error(
      tokenPayload.error?.message ||
        `Failed to generate Power BI embed token (${tokenResponse.status})`
    );
  }

  return {
    reportId: report.id,
    embedUrl: report.embedUrl,
    token: tokenPayload.token,
    tokenType: 'Embed',
    expiration: tokenPayload.expiration,
  };
}

module.exports = {
  getEmbedConfig,
};
