import { powerbiConfig, validatePowerbiConfig } from '../powerbiConfig';

export interface PowerbiEmbedToken {
  reportId: string;
  embedUrl: string;
  token: string;
  expiration: string;
}

export class PowerbiService {
  private static instance: PowerbiService;

  private constructor() {
    if (!validatePowerbiConfig()) {
      throw new Error('PowerBI configuration is invalid. Please check src/powerbiConfig.ts');
    }
  }

  public static getInstance(): PowerbiService {
    if (!PowerbiService.instance) {
      PowerbiService.instance = new PowerbiService();
    }
    return PowerbiService.instance;
  }

  /** Organization embed URL (autoAuth) — no server token API required for viewing. */
  public async generateEmbedToken(reportId: string = powerbiConfig.reportId): Promise<PowerbiEmbedToken> {
    const embedUrl =
      `https://app.powerbi.com/reportEmbed?reportId=${reportId}` +
      `&autoAuth=true&ctid=${powerbiConfig.tenantId}` +
      `&filterPaneEnabled=false&navContentPaneEnabled=false` +
      `&config=eyJjbHVzdGVyVXJsIjoiaHR0cHM6Ly9XaW5kcy1OLXByaW1hcnktcmVkaXJlY3QuYW5hbHlzaXMud2luZG93cy5uZXQiLCJlbWJlZEZlYXR1cmVzIjp7Im1vZGVybiI6dHJ1ZX0sImxvY2FsZSI6ImVuLVVTIiwiYWNjZXNzVGV4dCI6IkVtYmVkIGZvciB5b3VyIG9yZ2FuaXphdGlvbiIsImVtYmVkRmVhdHVyZXMiOnsibW9kZXJuIjp0cnVlfX0%3d`;

    return {
      reportId,
      embedUrl,
      token: '',
      expiration: new Date(Date.now() + 3600000).toISOString(),
    };
  }

  public validateConfiguration(): boolean {
    return validatePowerbiConfig();
  }
}
