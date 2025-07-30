import { powerbiConfig, validatePowerbiConfig } from '../powerbiConfig';

// ============================================================================
// POWERBI SERVICE - BACKEND TOKEN GENERATION
// ============================================================================
// 
// This service handles PowerBI authentication using the service principal
// and generates embed tokens for the frontend to use.
//
// ⚠️  IMPORTANT: This should be moved to your backend server in production
//     For now, it's here for demonstration purposes
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

  // Get access token for PowerBI API
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiration && new Date() < this.tokenExpiration) {
      return this.accessToken;
    }

    try {
      // In a real implementation, this would be a backend API call
      // For now, we'll simulate the token acquisition
      console.log('🔐 Acquiring PowerBI access token...');
      
      // This is where you'd make the actual Azure AD token request
      // For demonstration, we'll return a mock token
      const mockToken = 'mock-powerbi-access-token';
      this.accessToken = mockToken;
      this.tokenExpiration = new Date(Date.now() + 3600000); // 1 hour from now
      
      console.log('✅ PowerBI access token acquired successfully');
      return mockToken;
    } catch (error) {
      console.error('❌ Failed to acquire PowerBI access token:', error);
      throw new Error('Failed to authenticate with PowerBI');
    }
  }

  // Generate embed token for a specific report
  public async generateEmbedToken(reportId: string): Promise<PowerbiEmbedToken> {
    try {
      const accessToken = await this.getAccessToken();
      
      console.log('🔑 Generating PowerBI embed token...');
      
      // In a real implementation, this would call the PowerBI REST API
      // POST https://api.powerbi.com/v1.0/myorg/reports/{reportId}/GenerateToken
      
      const mockEmbedToken: PowerbiEmbedToken = {
        // 🔓 BYPASS: Using "Embed for your organization" - any Azure AD user can access
        embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${reportId}&autoAuth=true&ctid=${powerbiConfig.tenantId}&filterPaneEnabled=false&navContentPaneEnabled=false&config=eyJjbHVzdGVyVXJsIjoiaHR0cHM6Ly9XaW5kcy1OLXByaW1hcnktcmVkaXJlY3QuYW5hbHlzaXMud2luZG93cy5uZXQiLCJlbWJlZEZlYXR1cmVzIjp7Im1vZGVybiI6dHJ1ZX0sImxvY2FsZSI6ImVuLVVTIiwiYWNjZXNzVGV4dCI6IkVtYmVkIGZvciB5b3VyIG9yZ2FuaXphdGlvbiIsImVtYmVkRmVhdHVyZXMiOnsibW9kZXJuIjp0cnVlfX0%3d`,
        token: 'mock-embed-token',
        expiration: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      };
      
      console.log('✅ PowerBI embed token generated successfully');
      return mockEmbedToken;
    } catch (error) {
      console.error('❌ Failed to generate PowerBI embed token:', error);
      throw new Error('Failed to generate PowerBI embed token');
    }
  }

  // Get all reports in the workspace
  public async getReports(): Promise<PowerbiReport[]> {
    try {
      const accessToken = await this.getAccessToken();
      
      console.log('📊 Fetching PowerBI reports...');
      
      // In a real implementation, this would call the PowerBI REST API
      // GET https://api.powerbi.com/v1.0/myorg/reports
      
      const mockReports: PowerbiReport[] = [
        {
          id: powerbiConfig.reportId,
          name: 'Company Progress Report',
          embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${powerbiConfig.reportId}&autoAuth=true&ctid=${powerbiConfig.tenantId}`
        }
      ];
      
      console.log('✅ PowerBI reports fetched successfully');
      return mockReports;
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