export const msalConfig = {
  auth: {
    clientId: "543ae09d-95e7-47bb-b679-e4428c20918e",
    authority: "https://login.microsoftonline.com/63fbe43e-8963-4cb6-8f87-2ecc3cd029b4",
    redirectUri: "https://intranet.symphonywireless.com",
    // redirectUri: "https://technology-reports.d2ryoyr4gox6p1.amplifyapp.com",
    // redirectUri: "http://localhost:3000"
  },
  cache: {
    cacheLocation: "localStorage", // Use localStorage for persistence
    storeAuthStateInCookie: true, // If you want cookies, set to true
  },
};

export const loginRequest = {
  scopes: ["User.Read", "GroupMember.Read.All"], // Added GroupMember.Read.All for RBAC
};

// IntranetExecs security group ID
export const INTRANET_EXECS_GROUP_ID = '47033fd4-2aed-482d-9ad4-c580103dacfa';

// Function to check if user is in elite group using Microsoft Graph API
export const isEliteGroupMember = async (msalInstance: any): Promise<boolean> => {
  try {
    console.log('🔍 Starting elite group membership check...');
    
    // Get the active account
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      console.log('🔍 No accounts found, user not authenticated');
      return false;
    }
    
    const activeAccount = accounts[0];
    console.log('🔍 Active account:', activeAccount.username);
    
    const graphScopes = ["User.Read", "GroupMember.Read.All"];
    
    // Try to acquire token with better error handling
    let accessToken;
    try {
      // Try to acquire token silently first
      accessToken = await msalInstance.acquireTokenSilent({ 
        scopes: graphScopes,
        account: activeAccount
      });
      console.log('🔍 Got access token for Graph API (silent)');
    } catch (silentError) {
      console.log('🔍 Silent token acquisition failed, trying interactive login...');
      
      // If silent token acquisition fails, try interactive login
      accessToken = await msalInstance.acquireTokenPopup({ 
        scopes: graphScopes,
        account: activeAccount
      });
      console.log('🔍 Got access token for Graph API (interactive)');
    }
    
    if (!accessToken || !accessToken.accessToken) {
      console.error('❌ Failed to acquire access token');
      return false;
    }
    
    // Make the API call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me/memberOf", {
        headers: {
          Authorization: `Bearer ${accessToken.accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        console.error('❌ Failed to fetch group membership:', res.status, res.statusText);
        return false;
      }
      
      const groups = await res.json();
      console.log('🔍 User groups:', groups.value.map((g: any) => ({ name: g.displayName, id: g.id })));
      
      const isInGroup = groups.value.some((group: any) => group.id === INTRANET_EXECS_GROUP_ID);
      console.log('🔍 Checking against group ID:', INTRANET_EXECS_GROUP_ID);
      console.log('🔍 Found matching group:', groups.value.find((g: any) => g.id === INTRANET_EXECS_GROUP_ID));
      console.log('🔍 Is in elite group:', isInGroup);
      
      return isInGroup;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('❌ Request timed out');
      } else {
        console.error('❌ Fetch error:', fetchError);
      }
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking group membership:', error);
    return false;
  }
};