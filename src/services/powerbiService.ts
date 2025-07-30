import { powerbiConfig, validatePowerbiConfig } from '../powerbiConfig';

// ============================================================================
// POWERBI SERVICE - REAL SERVICE PRINCIPAL IMPLEMENTATION
// ============================================================================
// 
// This service uses the Azure AD service principal to generate embed tokens
// that bypass individual PowerBI user permissions.
//
// ============================================================================

interface PowerbiEmbedToken {
  embedUrl: string;
  token: string;
  expiration: string;
}

interface PowerbiReport {
  id: string;
  name: string;
  embedUrl: string;
}

export class PowerbiService {
  private static instance: PowerbiService;
  private accessToken: string | null = null;
  private tokenExpiration: Date | null = null;

  private constructor() {
    // Validate configuration on service initialization
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

  // Get access token for PowerBI API using service principal
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiration && new Date() < this.tokenExpiration) {
      return this.accessToken;
    }

    try {
      console.log('🔐 Acquiring PowerBI access token using service principal...');
      
      // Make actual Azure AD token request
      const tokenResponse = await fetch(`https://login.microsoftonline.com/${powerbiConfig.tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: powerbiConfig.clientId,
          client_secret: powerbiConfig.clientSecret,
          scope: 'https://analysis.windows.net/powerbi/api/.default'
        })
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token request failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
      }

      const tokenData = await tokenResponse.json();
      this.accessToken = tokenData.access_token;
      this.tokenExpiration = new Date(Date.now() + (tokenData.expires_in * 1000));
      
      console.log('✅ PowerBI access token acquired successfully');
      return this.accessToken!;
    } catch (error) {
      console.error('❌ Failed to acquire PowerBI access token:', error);
      throw new Error('Failed to authenticate with PowerBI using service principal');
    }
  }

  // Generate embed token for a specific report using PowerBI REST API
  public async generateEmbedToken(reportId: string): Promise<PowerbiEmbedToken> {
    try {
      const accessToken = await this.getAccessToken();
      
      console.log('🔑 Generating PowerBI embed token using REST API...');
      
      // Call PowerBI REST API to generate embed token
      const embedTokenResponse = await fetch(`https://api.powerbi.com/v1.0/myorg/reports/${reportId}/GenerateToken`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessLevel: 'View',
          allowSaveAs: false,
          identities: [{
            username: 'service-principal',
            roles: ['Viewer'],
            datasets: [powerbiConfig.workspaceId]
          }]
        })
      });

      if (!embedTokenResponse.ok) {
        const errorText = await embedTokenResponse.text();
        console.error('Embed token request failed:', errorText);
        throw new Error(`Failed to generate embed token: ${embedTokenResponse.status}`);
      }

      const embedTokenData = await embedTokenResponse.json();
      
      const embedToken: PowerbiEmbedToken = {
        embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${reportId}&autoAuth=true&ctid=${powerbiConfig.tenantId}&filterPaneEnabled=false&navContentPaneEnabled=false`,
        token: embedTokenData.token,
        expiration: embedTokenData.expiration
      };
      
      console.log('✅ PowerBI embed token generated successfully using service principal');
      return embedToken;
    } catch (error) {
      console.error('❌ Failed to generate PowerBI embed token:', error);
      throw new Error('Failed to generate PowerBI embed token using service principal');
    }
  }

  // Get all reports in the workspace
  public async getReports(): Promise<PowerbiReport[]> {
    try {
      const accessToken = await this.getAccessToken();
      
      console.log('📊 Fetching PowerBI reports...');
      
      const reportsResponse = await fetch('https://api.powerbi.com/v1.0/myorg/reports', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });

      if (!reportsResponse.ok) {
        throw new Error(`Failed to fetch reports: ${reportsResponse.status}`);
      }

      const reportsData = await reportsResponse.json();
      
      const reports: PowerbiReport[] = reportsData.value.map((report: any) => ({
        id: report.id,
        name: report.name,
        embedUrl: report.embedUrl
      }));
      
      console.log('✅ PowerBI reports fetched successfully');
      return reports;
    } catch (error) {
      console.error('❌ Failed to fetch PowerBI reports:', error);
      throw new Error('Failed to fetch PowerBI reports');
    }
  }

  // Validate the service configuration
  public validateConfiguration(): boolean {
    return validatePowerbiConfig();
  }
}

// ============================================================================
// FRONTEND USAGE EXAMPLE
// ============================================================================
//
// In your HomePage component:
//
// import { PowerbiService } from '../services/powerbiService';
//
// const HomePage: React.FC<HomePageProps> = ({ userInfo }) => {
//   const [powerbiConfig, setPowerbiConfig] = useState<PowerbiEmbedToken | null>(null);
//
//   useEffect(() => {
//     const loadPowerbiConfig = async () => {
//       try {
//         const powerbiService = PowerbiService.getInstance();
//         const embedToken = await powerbiService.generateEmbedToken(powerbiConfig.reportId);
//         setPowerbiConfig(embedToken);
//       } catch (error) {
//         console.error('Failed to load PowerBI configuration:', error);
//       }
//     };
//
//     loadPowerbiConfig();
//   }, []);
//
//   return (
//     <div>
//       {powerbiConfig && (
//         <iframe
//           title="Company Progress"
//           width="100%"
//           height="425"
//           src={`${powerbiConfig.embedUrl}&embedToken=${powerbiConfig.token}`}
//           frameBorder="0"
//           allowFullScreen={false}
//         />
//       )}
//     </div>
//   );
// };
//
// ============================================================================ 