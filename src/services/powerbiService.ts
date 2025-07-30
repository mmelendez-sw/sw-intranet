import { powerbiConfig, validatePowerbiConfig } from '../powerbiConfig';

// ============================================================================
// POWERBI SERVICE - FRONTEND-FRIENDLY APPROACH
// ============================================================================
// 
// This service uses a direct PowerBI embed approach that works from the frontend
// without requiring backend token generation (which would have CORS issues).
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

  // Generate embed token using direct PowerBI embed approach
  public async generateEmbedToken(reportId: string): Promise<PowerbiEmbedToken> {
    try {
      console.log('🔑 Generating PowerBI embed configuration...');
      console.log('📊 Using report ID:', reportId);
      console.log('🏢 Using tenant ID:', powerbiConfig.tenantId);
      
      // 🔓 DIRECT EMBED APPROACH: Use PowerBI's "Embed for your organization"
      // This approach works without requiring service principal token generation
      // and bypasses CORS issues by using PowerBI's built-in authentication
      
      const embedUrl = `https://app.powerbi.com/reportEmbed?reportId=${reportId}&autoAuth=true&ctid=${powerbiConfig.tenantId}&filterPaneEnabled=false&navContentPaneEnabled=false&config=eyJjbHVzdGVyVXJsIjoiaHR0cHM6Ly9XaW5kcy1OLXByaW1hcnktcmVkaXJlY3QuYW5hbHlzaXMud2luZG93cy5uZXQiLCJlbWJlZEZlYXR1cmVzIjp7Im1vZGVybiI6dHJ1ZX0sImxvY2FsZSI6ImVuLVVTIiwiYWNjZXNzVGV4dCI6IkVtYmVkIGZvciB5b3VyIG9yZ2FuaXphdGlvbiIsImVtYmVkRmVhdHVyZXMiOnsibW9kZXJuIjp0cnVlfX0%3d`;
      
      const embedToken: PowerbiEmbedToken = {
        embedUrl: embedUrl,
        token: '', // No token needed for direct embed
        expiration: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      };
      
      console.log('✅ PowerBI embed configuration generated successfully');
      console.log('🔓 Using direct embed approach - works with existing Azure AD authentication');
      return embedToken;
    } catch (error) {
      console.error('❌ Failed to generate PowerBI embed configuration:', error);
      throw new Error(`Failed to generate PowerBI embed configuration: ${error}`);
    }
  }

  // Get all reports in the workspace (simplified for frontend)
  public async getReports(): Promise<PowerbiReport[]> {
    try {
      console.log('📊 Fetching PowerBI reports...');
      
      // For frontend approach, we'll return the configured report
      const reports: PowerbiReport[] = [
        {
          id: powerbiConfig.reportId,
          name: 'Company Progress Report',
          embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${powerbiConfig.reportId}&autoAuth=true&ctid=${powerbiConfig.tenantId}`
        }
      ];
      
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