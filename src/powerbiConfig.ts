// ============================================================================
// POWERBI SERVICE PRINCIPAL CONFIGURATION
// ============================================================================
// 
// ⚠️  REQUIRED: Replace these placeholder values with your actual Azure AD credentials
// 
// 1. Create a Service Principal in Azure AD:
//    - Go to Azure Portal > Azure Active Directory > App registrations
//    - Click "New registration"
//    - Name: "PowerBI-Service-Principal"
//    - Supported account types: "Accounts in this organizational directory only"
//    - Click "Register"
//
// 2. Get the Client ID:
//    - Copy the "Application (client) ID" from the Overview page
//
// 3. Create a Client Secret:
//    - Go to "Certificates & secrets" in the left menu
//    - Click "New client secret"
//    - Add description: "PowerBI Service Principal Secret"
//    - Copy the secret value immediately (you won't see it again)
//
// 4. Get the Tenant ID:
//    - Copy the "Directory (tenant) ID" from the Overview page
//
// 5. Grant PowerBI Permissions:
//    - Go to "API permissions" in the left menu
//    - Click "Add a permission"
//    - Select "Power BI Service"
//    - Choose "Application permissions"
//    - Select "Report.Read.All" and "Workspace.Read.All"
//    - Click "Grant admin consent"
//
// ============================================================================

export const powerbiConfig = {
  // 🔑 REPLACE WITH YOUR ACTUAL CLIENT ID FROM AZURE AD APP REGISTRATION
  clientId: "ee0298d2-1776-444c-ae9f-bc2525c60227",
  
  // 🔐 REPLACE WITH YOUR ACTUAL CLIENT SECRET FROM AZURE AD
  clientSecret: "iVq8Q~vwAJa.ki_Tmm_CEdir7Sk~JNgn_fgmmc.w",
  
  // 🏢 REPLACE WITH YOUR ACTUAL TENANT ID FROM AZURE AD
  tenantId: "63fbe43e-8963-4cb6-8f87-2ecc3cd029b4",
  
  // 📊 POWERBI WORKSPACE AND REPORT CONFIGURATION
  workspaceId: "113D281A-8FE0-4D14-829E-30BDE3A28F49",
  reportId: "e091da31-91dd-42c2-9b17-099d2e07c492", // ✅ Confirmed from your URL
  
  // 🔗 AUTHORITY URL (usually doesn't need to change)
  authority: "https://login.microsoftonline.com/63fbe43e-8963-4cb6-8f87-2ecc3cd029b4"
};

// ============================================================================
// ENVIRONMENT VARIABLES (Alternative approach)
// ============================================================================
// 
// Instead of hardcoding values, you can use environment variables:
// 
// export const powerbiConfig = {
//   clientId: process.env.REACT_APP_POWERBI_CLIENT_ID || "YOUR_CLIENT_ID",
//   clientSecret: process.env.REACT_APP_POWERBI_CLIENT_SECRET || "YOUR_CLIENT_SECRET",
//   tenantId: process.env.REACT_APP_POWERBI_TENANT_ID || "YOUR_TENANT_ID",
//   workspaceId: process.env.REACT_APP_POWERBI_WORKSPACE_ID || "YOUR_WORKSPACE_ID",
//   reportId: process.env.REACT_APP_POWERBI_REPORT_ID || "e091da31-91dd-42c2-9b17-099d2e07c492",
//   authority: `https://login.microsoftonline.com/${process.env.REACT_APP_POWERBI_TENANT_ID || "YOUR_TENANT_ID"}`
// };
//
// Then create a .env file in your project root:
// REACT_APP_POWERBI_CLIENT_ID=your-client-id
// REACT_APP_POWERBI_CLIENT_SECRET=your-client-secret
// REACT_APP_POWERBI_TENANT_ID=your-tenant-id
// REACT_APP_POWERBI_WORKSPACE_ID=your-workspace-id
//
// ============================================================================

// Helper function to validate configuration
export const validatePowerbiConfig = () => {
  const requiredFields = ['clientId', 'clientSecret', 'tenantId', 'workspaceId'] as const;
  const missingFields = requiredFields.filter(field => 
    !powerbiConfig[field] || powerbiConfig[field].includes('YOUR_') || powerbiConfig[field].includes('HERE')
  );
  
  if (missingFields.length > 0) {
    console.error('❌ POWERBI CONFIGURATION ERROR:');
    console.error('Missing or placeholder values for:', missingFields);
    console.error('Please update src/powerbiConfig.ts with your actual Azure AD credentials');
    return false;
  }
  
  console.log('✅ PowerBI configuration validated successfully');
  return true;
}; 