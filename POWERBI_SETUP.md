# PowerBI Service Principal Setup Guide

## Overview
This guide will help you set up a PowerBI service principal in Azure AD to bypass individual user permissions and allow all authenticated users to view PowerBI reports without requiring individual PowerBI licenses.

## Step 1: Create Service Principal in Azure AD

### 1.1 Create App Registration
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **"New registration"**
4. Fill in the details:
   - **Name**: `PowerBI-Service-Principal`
   - **Supported account types**: "Accounts in this organizational directory only"
   - **Redirect URI**: Leave blank for now
5. Click **"Register"**

### 1.2 Get Client ID and Tenant ID
1. From the app registration overview page, copy:
   - **Application (client) ID** → This is your `clientId`
   - **Directory (tenant) ID** → This is your `tenantId`

### 1.3 Create Client Secret
1. In the left menu, click **"Certificates & secrets"**
2. Click **"New client secret"**
3. Add description: `PowerBI Service Principal Secret`
4. Set expiration (recommend 24 months)
5. Click **"Add"**
6. **IMPORTANT**: Copy the secret value immediately (you won't see it again)
   - This is your `clientSecret`

## Step 2: Configure API Permissions

### 2.1 Add PowerBI Permissions
1. In the left menu, click **"API permissions"**
2. Click **"Add a permission"**
3. Select **"Power BI Service"**
4. Choose **"Application permissions"**
5. Select:
   - ✅ `Tenant.Read.All` (this should be sufficient)
   - If available: `Report.Read.All` and `Workspace.Read.All`
6. Click **"Add permissions"**

### 2.2 Grant Admin Consent
1. Click the **"Grant admin consent"** button
2. Confirm the permissions are granted

## Step 3: Grant Service Principal Access to PowerBI Workspace

### 3.1 Add Service Principal to PowerBI Workspace
1. Go to [PowerBI Service](https://app.powerbi.com)
2. Navigate to your workspace (the one containing your reports)
3. Click **"Access"** in the workspace settings
4. Click **"Add"**
5. Search for your service principal name: `PowerBI-Service-Principal`
6. Select it and assign **"Member"** or **"Admin"** role
7. Click **"Add"**

### 3.2 Alternative: Grant Access via PowerShell
If the above doesn't work, you can use PowerShell:

```powershell
# Install PowerBI PowerShell module
Install-Module -Name MicrosoftPowerBIMgmt

# Connect to PowerBI
Connect-PowerBIServiceAccount

# Add service principal to workspace
Add-PowerBIWorkspaceUser -WorkspaceId "113D281A-8FE0-4D14-829E-30BDE3A28F49" -UserEmail "your-service-principal-name@yourtenant.onmicrosoft.com" -AccessRight Member
```

## Step 4: Find PowerBI IDs

### 4.1 Get Report ID
From your PowerBI report URL:
```
https://app.powerbi.com/groups/me/reports/e091da31-91dd-42c2-9b17-099d2e07c492/da99a39683128769e3b5?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&experience=power-bi
```
- **Report ID**: `e091da31-91dd-42c2-9b17-099d2e07c492`

### 4.2 Get Workspace ID
1. Go to [PowerBI Admin Portal](https://app.powerbi.com/admin-portal)
2. Navigate to **"Workspaces"**
3. Find your workspace and copy the **Workspace ID**
4. Or use the workspace ID from your URL: `113D281A-8FE0-4D14-829E-30BDE3A28F49`

### 4.3 Get Tenant ID
- **Tenant ID**: `63fbe43e-8963-4cb6-8f87-2ecc3cd029b4` (from your URLs)

## Step 5: Update Configuration

### 5.1 Update powerbiConfig.ts
Update `src/powerbiConfig.ts` with your actual values:

```typescript
export const powerbiConfig = {
  clientId: "YOUR_ACTUAL_CLIENT_ID",
  clientSecret: "YOUR_ACTUAL_CLIENT_SECRET",
  tenantId: "63fbe43e-8963-4cb6-8f87-2ecc3cd029b4",
  workspaceId: "113D281A-8FE0-4D14-829E-30BDE3A28F49",
  reportId: "e091da31-91dd-42c2-9b17-099d2e07c492",
  authority: "https://login.microsoftonline.com/63fbe43e-8963-4cb6-8f87-2ecc3cd029b4"
};
```

## Troubleshooting

### Issue: Users still prompted for sign-in
**Solution**: Ensure the service principal has been added to the PowerBI workspace with appropriate permissions.

### Issue: CORS errors
**Solution**: The current implementation uses a frontend-friendly approach that avoids CORS issues.

### Issue: Permission denied
**Solution**: 
1. Verify admin consent was granted for the API permissions
2. Ensure the service principal is added to the PowerBI workspace
3. Check that the workspace ID and report ID are correct

## Bypass User Permissions

The key to bypassing individual user permissions is:
1. **Service Principal Access**: The service principal acts on behalf of the application
2. **Workspace Membership**: Adding the service principal to the PowerBI workspace
3. **Application Permissions**: Using `Tenant.Read.All` instead of delegated permissions

This approach allows any authenticated Azure AD user to view the reports without requiring individual PowerBI licenses. 