# 🔐 POWERBI SERVICE PRINCIPAL SETUP GUIDE

## ⚠️  CRITICAL: YOU MUST COMPLETE THIS SETUP BEFORE POWERBI WILL WORK

This guide will help you set up PowerBI authentication using a service principal, which eliminates the need for users to sign in to PowerBI directly.

---

## 📋 PREREQUISITES

- Azure AD Administrator access
- PowerBI Pro or Premium license
- Access to your PowerBI workspace

---

## 🚀 STEP-BY-STEP SETUP

### Step 1: Create Azure AD Service Principal

1. **Go to Azure Portal**
   - Navigate to: https://portal.azure.com
   - Sign in with your admin account

2. **Create App Registration**
   - Go to **Azure Active Directory** > **App registrations**
   - Click **"New registration"**
   - Fill in the details:
     - **Name**: `PowerBI-Service-Principal`
     - **Supported account types**: `Accounts in this organizational directory only`
     - **Redirect URI**: Leave blank for now
   - Click **"Register"**

3. **Copy the Client ID**
   - From the Overview page, copy the **"Application (client) ID"**
   - This is your `CLIENT_ID` - save it for later

4. **Copy the Tenant ID**
   - From the Overview page, copy the **"Directory (tenant) ID"**
   - This is your `TENANT_ID` - save it for later

### Step 2: Create Client Secret

1. **Go to Certificates & Secrets**
   - In the left menu, click **"Certificates & secrets"**
   - Click **"New client secret"**

2. **Create the Secret**
   - Description: `PowerBI Service Principal Secret`
   - Expiration: Choose an appropriate duration (recommend 12 months)
   - Click **"Add"**

3. **Copy the Secret Value**
   - **⚠️  IMPORTANT**: Copy the secret value immediately
   - You won't be able to see it again after leaving this page
   - This is your `CLIENT_SECRET` - save it securely

### Step 3: Configure API Permissions

1. **Go to API Permissions**
   - In the left menu, click **"API permissions"**
   - Click **"Add a permission"**

2. **Add PowerBI Permissions**
   - Select **"Power BI Service"**
   - Choose **"Application permissions"**
   - Select these permissions:
     - ✅ `Report.Read.All`
     - ✅ `Workspace.Read.All`
   - Click **"Add permissions"**

3. **Grant Admin Consent**
   - Click **"Grant admin consent for [Your Organization]"**
   - Confirm the action

### Step 3.5: 🔓 BYPASS USER PERMISSIONS (IMPORTANT)

**To allow ALL users to see the PowerBI report (bypass individual PowerBI access):**

1. **Go to PowerBI Workspace**
   - Navigate to: https://app.powerbi.com
   - Go to your workspace containing the report

2. **Grant Service Principal Access**
   - Click **"Access"** in the workspace
   - Click **"Add"**
   - Search for your service principal name: `PowerBI-Service-Principal`
   - Set role to **"Admin"** or **"Member"**
   - Click **"Add"**

3. **Alternative: Use "Embed for Your Organization"**
   - In PowerBI, go to your report
   - Click **"Share"** > **"Embed"**
   - Choose **"Embed for your organization"**
   - Copy the embed URL and update the service

**Result:** Any authenticated user in your Azure AD can now see the report through your app, regardless of their individual PowerBI permissions.

### Step 4: Get PowerBI Workspace ID

1. **Go to PowerBI Service**
   - Navigate to: https://app.powerbi.com
   - Go to your workspace

2. **Get Workspace ID**
   - In the URL, you'll see something like: `https://app.powerbi.com/groups/12345678-1234-1234-1234-123456789012`
   - The long string after `/groups/` is your `WORKSPACE_ID`

### Step 5: Update Configuration File

1. **Open the Configuration File**
   - Navigate to: `src/powerbiConfig.ts`

2. **Replace the Placeholder Values**
   ```typescript
   export const powerbiConfig = {
     // 🔑 REPLACE WITH YOUR ACTUAL CLIENT ID FROM AZURE AD APP REGISTRATION
     clientId: "YOUR_ACTUAL_CLIENT_ID_HERE",
     
     // 🔐 REPLACE WITH YOUR ACTUAL CLIENT SECRET FROM AZURE AD
     clientSecret: "YOUR_ACTUAL_CLIENT_SECRET_HERE",
     
     // 🏢 REPLACE WITH YOUR ACTUAL TENANT ID FROM AZURE AD
     tenantId: "YOUR_ACTUAL_TENANT_ID_HERE",
     
     // 📊 REPLACE WITH YOUR ACTUAL WORKSPACE ID FROM POWERBI
     workspaceId: "YOUR_ACTUAL_WORKSPACE_ID_HERE",
     
     // 🔗 UPDATE AUTHORITY URL WITH YOUR TENANT ID
     authority: "https://login.microsoftonline.com/YOUR_ACTUAL_TENANT_ID_HERE"
   };
   ```

3. **Example with Real Values**
   ```typescript
   export const powerbiConfig = {
     clientId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
     clientSecret: "ABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD890EFG",
     tenantId: "12345678-1234-1234-1234-123456789012",
     workspaceId: "87654321-4321-4321-4321-210987654321",
     authority: "https://login.microsoftonline.com/12345678-1234-1234-1234-123456789012"
   };
   ```

---

## 🔍 VERIFICATION STEPS

### 1. Check Configuration
```bash
# The app will log configuration status on startup
# Look for: "✅ PowerBI configuration validated successfully"
```

### 2. Test PowerBI Service
```javascript
// In browser console, run:
import { PowerbiService } from './src/services/powerbiService';
const service = PowerbiService.getInstance();
service.validateConfiguration(); // Should return true
```

### 3. Check Network Tab
- Open browser DevTools
- Go to Network tab
- Load the homepage
- Look for PowerBI API calls (they may be mocked initially)

---

## 🚨 TROUBLESHOOTING

### Common Issues:

1. **"Configuration Error"**
   - Check that all placeholder values are replaced
   - Verify Client ID, Client Secret, and Tenant ID are correct

2. **"Permission Denied"**
   - Ensure admin consent was granted for API permissions
   - Check that the service principal has access to the PowerBI workspace

3. **"Token Generation Failed"**
   - Verify the Client Secret is correct and not expired
   - Check that the Tenant ID matches your Azure AD tenant

4. **"Workspace Not Found"**
   - Verify the Workspace ID is correct
   - Ensure the service principal has access to the workspace

---

## 🔒 SECURITY NOTES

- **Never commit secrets to version control**
- **Use environment variables in production**
- **Rotate client secrets regularly**
- **Monitor service principal usage**

---

## 📞 SUPPORT

If you encounter issues:
1. Check the browser console for error messages
2. Verify all configuration values are correct
3. Ensure all Azure AD permissions are properly set
4. Contact your Azure AD administrator if needed

---

## ✅ COMPLETION CHECKLIST

- [ ] Azure AD App Registration created
- [ ] Client ID copied and saved
- [ ] Client Secret created and saved
- [ ] Tenant ID copied and saved
- [ ] API permissions configured
- [ ] Admin consent granted
- [ ] PowerBI Workspace ID obtained
- [ ] Configuration file updated with real values
- [ ] App restarted and tested
- [ ] PowerBI embed loads without sign-in prompt

**🎉 Once all items are checked, PowerBI authentication should work seamlessly!** 