import { POWERBI_EMBED_TOKEN_URL } from '../authConfig';
import { powerbiConfig } from '../powerbiConfig';

export interface PowerbiEmbedToken {
  reportId: string;
  embedUrl: string;
  token: string;
  tokenType: 'Embed' | 'Aad';
  expiration: string;
}

const DEFAULT_REPORT_ID = powerbiConfig.reportId || 'e091da31-91dd-42c2-9b17-099d2e07c492';

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