// Environment variables with fallbacks for development
const getEnvVar = (key: string, fallback: string): string => {
  const value = import.meta.env[key];
  return value || fallback;
};

export const msalConfig = {
  auth: {
    clientId: getEnvVar('VITE_AZURE_CLIENT_ID', '543ae09d-95e7-47bb-b679-e4428c20918e'),
    authority: getEnvVar('VITE_AZURE_AUTHORITY', 'https://login.microsoftonline.com/63fbe43e-8963-4cb6-8f87-2ecc3cd029b4'),
    redirectUri: getEnvVar('VITE_AZURE_REDIRECT_URI', window.location.origin),
  },
  cache: {
    cacheLocation: "localStorage" as const,
    storeAuthStateInCookie: true,
  },
};

export const loginRequest = {
  scopes: ["User.Read", "GroupMember.Read.All"],
};

// IntranetExecs security group ID
export const INTRANET_EXECS_GROUP_ID = getEnvVar('VITE_ELITE_GROUP_ID', '47033fd4-2aed-482d-9ad4-c580103dacfa');

import type { IPublicClientApplication, AccountInfo } from '@azure/msal-browser';

interface GroupResponse {
  value: Array<{
    id: string;
    displayName: string;
  }>;
}

// Function to check if user is in elite group using Microsoft Graph API
export const isEliteGroupMember = async (
  msalInstance: IPublicClientApplication
): Promise<boolean> => {
  try {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      return false;
    }
    
    const activeAccount: AccountInfo = accounts[0];
    const graphScopes = ["User.Read", "GroupMember.Read.All"];
    
    // Try to acquire token silently first
    let accessToken;
    try {
      accessToken = await msalInstance.acquireTokenSilent({ 
        scopes: graphScopes,
        account: activeAccount
      });
    } catch (silentError) {
      // If silent token acquisition fails, try interactive login
      try {
        accessToken = await msalInstance.acquireTokenPopup({ 
          scopes: graphScopes,
          account: activeAccount
        });
      } catch (popupError) {
        return false;
      }
    }
    
    if (!accessToken?.accessToken) {
      return false;
    }
    
    // Make the API call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
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
        return false;
      }
      
      const groups: GroupResponse = await res.json();
      const isInGroup = groups.value.some(
        (group) => group.id === INTRANET_EXECS_GROUP_ID
      );
      
      return isInGroup;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        // Request timed out
      }
      return false;
    }
  } catch (error) {
    return false;
  }
};