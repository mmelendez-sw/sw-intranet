export const msalConfig = {
  auth: {
    clientId: "543ae09d-95e7-47bb-b679-e4428c20918e",
    authority: "https://login.microsoftonline.com/63fbe43e-8963-4cb6-8f87-2ecc3cd029b4",
    redirectUri: "https://intranet.symphonywireless.com",
    // redirectUri: "https://technology-reports.d2ryoyr4gox6p1.amplifyapp.com",
    // redirectUri: "http://localhost:3000"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: true,
  },
};

export const loginRequest = {
  // Sites.ReadWrite.All is required so authenticated users can read editable
  // content from SharePoint and so editors can save changes back.
  // An Azure AD admin must grant tenant-wide admin consent for this scope in the
  // Azure portal → App registrations → API permissions → Grant admin consent.
  scopes: [
    "User.Read",
    "GroupMember.Read.All",
    "Mail.Send",
    "Sites.ReadWrite.All",    // SharePoint content read/write (requires admin consent)
    "User.ReadBasic.All",     // Employee Directory — read all users' basic profiles (requires admin consent)
    "Calendars.Read",         // Calendar — read the signed-in user's Outlook events (user consent only)
  ],
};

// IntranetExecs security group ID
export const INTRANET_EXECS_GROUP_ID = '47033fd4-2aed-482d-9ad4-c580103dacfa';

// IntranetEditors security group ID
// To set this up:
//   1. Create a new Azure AD Security Group (e.g. "IntranetEditors")
//   2. Add the people who should be able to edit homepage/reports content
//   3. Copy the group's Object ID from Azure AD and paste it here
export const INTRANET_EDITORS_GROUP_ID = 'cbf6d5aa-f6ca-435d-a707-af1d1fac87a2';

// SharePoint site where editable content is stored
export const SHAREPOINT_HOST = 'symphonyinfrastructure.sharepoint.com';
export const SHAREPOINT_SITE_PATH = '/sites/SymphonyWirelessTeam';

// Shared helper — checks if the user belongs to a given Azure AD group ID.
const checkGroupMembership = async (msalInstance: any, groupId: string): Promise<boolean> => {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return false;

  const activeAccount = accounts[0];
  const graphScopes = ["User.Read", "GroupMember.Read.All"];

  let accessToken;
  try {
    accessToken = await msalInstance.acquireTokenSilent({ scopes: graphScopes, account: activeAccount });
  } catch {
    accessToken = await msalInstance.acquireTokenPopup({ scopes: graphScopes, account: activeAccount });
  }
  if (!accessToken?.accessToken) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("https://graph.microsoft.com/v1.0/me/memberOf", {
      headers: { Authorization: `Bearer ${accessToken.accessToken}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return false;
    const groups = await res.json();
    return groups.value.some((g: any) => g.id === groupId);
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
};

// Function to check if user is in elite group using Microsoft Graph API
export const isEliteGroupMember = async (msalInstance: any): Promise<boolean> => {
  try {
    return await checkGroupMembership(msalInstance, INTRANET_EXECS_GROUP_ID);
  } catch (error) {
    console.error('❌ Error checking elite group membership:', error);
    return false;
  }
};

// Function to check if user is in the content-editor group
export const isEditorGroupMember = async (msalInstance: any): Promise<boolean> => {
  try {
    return await checkGroupMembership(msalInstance, INTRANET_EDITORS_GROUP_ID);
  } catch (error) {
    console.error('❌ Error checking editor group membership:', error);
    return false;
  }
};