export const msalConfig = {
  auth: {
    clientId: "543ae09d-95e7-47bb-b679-e4428c20918e",
    authority: "https://login.microsoftonline.com/63fbe43e-8963-4cb6-8f87-2ecc3cd029b4",
    redirectUri: "https://intranet.symphonywireless.com",
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: true,
  },
};

export const loginRequest = {
  // Files.ReadWrite.All is required to append rows to the shared SharePoint
  // Excel workbook that logs lead submissions. Admin consent is needed once.
  scopes: ["User.Read", "GroupMember.Read.All", "Mail.Send", "Files.ReadWrite.All"],
};

// IntranetExecs security group ID
export const INTRANET_EXECS_GROUP_ID = '47033fd4-2aed-482d-9ad4-c580103dacfa';

export const isEliteGroupMember = async (msalInstance: any): Promise<boolean> => {
  try {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) return false;

    const activeAccount = accounts[0];
    const graphScopes = ["User.Read", "GroupMember.Read.All"];

    // Silent only: do not open acquireTokenPopup here. App.tsx calls this from
    // several effects in parallel; a popup for group lookup races with Lead
    // Generation's Mail.Send popup and surfaces MSAL interaction_in_progress.
    // loginRequest already includes these Graph scopes so silent should succeed
    // after sign-in; if not, we fail closed on Elite rather than break submits.
    let accessToken;
    try {
      accessToken = await msalInstance.acquireTokenSilent({
        scopes: graphScopes,
        account: activeAccount,
      });
    } catch {
      return false;
    }

    if (!accessToken?.accessToken) return false;

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

      if (!res.ok) return false;

      const groups = await res.json();
      return groups.value.some((group: any) => group.id === INTRANET_EXECS_GROUP_ID);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name !== 'AbortError') console.error('Graph API fetch error:', fetchError);
      return false;
    }
  } catch (error) {
    console.error('Error checking group membership:', error);
    return false;
  }
};
