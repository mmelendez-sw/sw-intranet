// Power BI License Service
// Handles checking if users have Power BI licenses

export const checkPowerBILicense = async (msalInstance: any): Promise<boolean> => {
  try {
    console.log('🔍 Checking Power BI license...');
    
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      console.log('🔍 No accounts found, user not authenticated');
      return false;
    }
    
    const activeAccount = accounts[0];
    console.log('🔍 Checking Power BI license for:', activeAccount.username);
    
    const graphScopes = ["User.Read", "User.Read.All"];
    
    // Acquire token for Graph API
    let accessToken;
    try {
      accessToken = await msalInstance.acquireTokenSilent({ 
        scopes: graphScopes,
        account: activeAccount
      });
      console.log('🔍 Got access token for license check (silent)');
    } catch (silentError) {
      console.log('🔍 Silent token acquisition failed, trying interactive login...');
      accessToken = await msalInstance.acquireTokenPopup({ 
        scopes: graphScopes,
        account: activeAccount
      });
      console.log('🔍 Got access token for license check (interactive)');
    }
    
    if (!accessToken || !accessToken.accessToken) {
      console.error('❌ Failed to acquire access token for license check');
      return false;
    }
    
    // Check user's license assignments
    const res = await fetch("https://graph.microsoft.com/v1.0/me/licenseDetails", {
      headers: {
        Authorization: `Bearer ${accessToken.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!res.ok) {
      console.error('❌ Failed to fetch license details:', res.status, res.statusText);
      return false;
    }
    
    const licenseDetails = await res.json();
    console.log('🔍 User license details:', licenseDetails.value);
    
    // Check for Power BI licenses
    const hasPowerBILicense = licenseDetails.value.some((license: any) => {
      const skuId = license.skuId;
      // Common Power BI SKU IDs
      const powerBISkus = [
        '70d33638-9c74-4d01-bfd3-562de28bd4ba', // Power BI Pro
        'f8a1db68-be16-40ed-86d5-cb42ce701560', // Power BI Premium Per User
        'e8c1fa11-1fc4-4a9f-8f61-f23d4b68aa65', // Power BI Premium Per Capacity
        'a403ebcc-fae0-4ca2-8c8c-7a907fd6c235', // Power BI (free)
        '1b1b1f7a-8355-43b6-829f-336cfccb744c', // Power BI Premium
        '06ebc4ee-1bb5-47dd-8120-11324bc54e06'  // Microsoft 365 E5
      ];
      
      return powerBISkus.includes(skuId);
    });
    
    console.log('🔍 Has Power BI license:', hasPowerBILicense);
    return hasPowerBILicense;
    
  } catch (error) {
    console.error('❌ Error checking Power BI license:', error);
    return false;
  }
};

// Helper function to check if a report is a Power BI report
export const isPowerBIReport = (report: any): boolean => {
  return report.link && report.link.includes('powerbi.com');
};

// INDEPENDENT STATUS INDICATORS:
// These functions are now completely independent of each other

// Get Power BI license status indicator (independent of elite group)
export const getPowerBILicenseIndicator = (hasPowerBILicense: boolean) => {
  if (!hasPowerBILicense) {
    return {
      backgroundColor: '#fff3cd',
      color: '#856404',
      text: '⚠️ Limited Access - Power BI reports require a Power BI license. Contact your administrator to request access.',
      border: '1px solid #ffeaa7'
    };
  } else {
    return {
      backgroundColor: '#e8f4fd',
      color: '#1e3a8a',
      text: '📊 Power BI License Active - Power BI Reports Available',
      border: 'none'
    };
  }
};

// Get elite group status indicator (independent of Power BI license)
export const getEliteGroupIndicator = (isEliteGroup: boolean) => {
  if (isEliteGroup) {
    return {
      backgroundColor: '#f0f0f0',
      color: '#333',
      text: '🏆 Elite Access - Additional reports available',
      border: 'none'
    };
  } else {
    return null; // No indicator for non-elite users
  }
};

// Legacy function for backward compatibility (now uses independent indicators)
export const getLicenseStatusIndicator = (hasPowerBILicense: boolean, isEliteGroup: boolean) => {
  // This function is kept for backward compatibility but now uses independent logic
  if (!hasPowerBILicense) {
    return {
      backgroundColor: '#fff3cd',
      color: '#856404',
      text: '⚠️ Limited Access - Power BI reports require a Power BI license. Contact your administrator to request access.',
      border: '1px solid #ffeaa7'
    };
  } else if (isEliteGroup) {
    return {
      backgroundColor: '#e8f5e8',
      color: '#2d5a2d',
      text: '🏆 Elite Access + Power BI License - All Reports Available',
      border: 'none'
    };
  } else {
    return {
      backgroundColor: '#e8f4fd',
      color: '#1e3a8a',
      text: '📊 Power BI License Active - Power BI Reports Available',
      border: 'none'
    };
  }
};
