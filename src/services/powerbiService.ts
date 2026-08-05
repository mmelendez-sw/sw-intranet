export interface PowerbiEmbedToken {
  reportId: string;
  embedUrl: string;
  token: string;
  tokenType: 'Embed' | 'Aad';
  expiration: string;
}

/**
 * Production: Amplify rewrites /api/* to the Lambda Function URL.
 * Override: window.INTRANET_API_BASE_URL = 'https://….lambda-url.us-east-2.on.aws'
 * Local: npm run api on :3001
 */
const POWERBI_EMBED_TOKEN_URL = (() => {
  if (typeof window === 'undefined') return '/api/powerbi/embed-token';
  const injected = (window as Window & { INTRANET_API_BASE_URL?: string }).INTRANET_API_BASE_URL;
  if (typeof injected === 'string' && injected.trim()) {
    return `${injected.trim().replace(/\/$/, '')}/api/powerbi/embed-token`;
  }
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:3001/api/powerbi/embed-token';
  }
  return '/api/powerbi/embed-token';
})();

const DEFAULT_REPORT_ID = 'e091da31-91dd-42c2-9b17-099d2e07c492';

export class PowerbiService {
  private static instance: PowerbiService;

  public static getInstance(): PowerbiService {
    if (!PowerbiService.instance) {
      PowerbiService.instance = new PowerbiService();
    }
    return PowerbiService.instance;
  }

  public async generateEmbedToken(reportId: string = DEFAULT_REPORT_ID): Promise<PowerbiEmbedToken> {
    const url = `${POWERBI_EMBED_TOKEN_URL}?reportId=${encodeURIComponent(reportId)}`;
    const response = await fetch(url);
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      reportId?: string;
      embedUrl?: string;
      token?: string;
      tokenType?: string;
      expiration?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || `Failed to get Power BI embed token (${response.status})`);
    }

    if (!data.embedUrl || !data.token) {
      throw new Error('Power BI embed response was missing embedUrl or token');
    }

    return {
      reportId: data.reportId || reportId,
      embedUrl: data.embedUrl,
      token: data.token,
      tokenType: data.tokenType === 'Aad' ? 'Aad' : 'Embed',
      expiration: data.expiration || '',
    };
  }
}