import { UserInfo } from './types/user';

/** Dev-only: skip MSAL login and grant full access. Keep false for deployed environments. */
export const BYPASS_AUTH = false;

export const DEV_USER_INFO: UserInfo = {
  isAuthenticated: true,
  isEliteGroup: true,
  isEditor: true,
  email: 'dev@symphonywireless.com',
  name: 'Dev User',
};

const appOrigin =
  typeof window !== 'undefined'
    ? window.location.origin
    : 'https://serena-dev.d2ryoyr4gox6p1.amplifyapp.com';

export const msalConfig = {
  auth: {
    clientId: "543ae09d-95e7-47bb-b679-e4428c20918e",
    authority: "https://login.microsoftonline.com/63fbe43e-8963-4cb6-8f87-2ecc3cd029b4",
    redirectUri: appOrigin,
    postLogoutRedirectUri: appOrigin,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: true,
  },
};

export const loginRequest = {
  // Files.ReadWrite.All — lead submission Excel workbook
  // Sites.ReadWrite.All — SharePoint CMS read/write (requires admin consent)
  // User.Read.All — Employee Directory (active users; requires admin consent)
  scopes: [
    "User.Read",
    "GroupMember.Read.All",
    "Mail.Send",
    "Files.ReadWrite.All",
    "Sites.ReadWrite.All",
    "User.Read.All",
    "Calendars.Read",
  ],
};

// IntranetExecs security group ID
export const INTRANET_EXECS_GROUP_ID = '47033fd4-2aed-482d-9ad4-c580103dacfa';

// IntranetEditors security group ID
export const INTRANET_EDITORS_GROUP_ID = 'cbf6d5aa-f6ca-435d-a707-af1d1fac87a2';

// Emails granted editor UI access without IntranetEditors group membership
export const EDIT_ALLOWLIST = new Set([
  'mmelendez@symphonyinfra.com',
  'shuang@symphonyinfra.com',
  'sraffington@symphonyinfra.com',
  'vasmar@symphonyinfra.com',
  'jpeterson@symphonyinfra.com',
  'htolani@symphonyinfra.com',
]);

export const isEditAllowlisted = (email?: string): boolean => {
  if (!email) return false;
  return EDIT_ALLOWLIST.has(email.toLowerCase());
};

export const resolveIsEditor = (isGroupMember: boolean, email?: string): boolean =>
  isGroupMember || isEditAllowlisted(email);

// SharePoint site where editable content is stored
export const SHAREPOINT_HOST = 'symphonyinfrastructure.sharepoint.com';
export const SHAREPOINT_SITE_PATH = '/sites/SymphonyWirelessTeam';
/** Intranet CMS: Shared Documents → General → intranet */
export const IMAGE_SHAREPOINT_SITE_PATH = SHAREPOINT_SITE_PATH;
export const INTRANET_CONTENT_FOLDER_PATH = 'General/intranet';
export const IMAGE_SHAREPOINT_FOLDER_PATH = 'General/intranet/images';
export const CARDS_DATA_FILENAME = 'homepage-cards.json';
export const ANNOUNCEMENTS_DATA_FILENAME = 'announcements.json';
export const REPORTS_DATA_FILENAME = 'reports.json';
export const SIDEBAR_DATA_FILENAME = 'homepage-sidebar.json';
export const QUICK_LINKS_DATA_FILENAME = 'quick-links.json';
export const SITE_CONFIG_DATA_FILENAME = 'site-config.json';
export const SIDEBAR_LAYOUT_DATA_FILENAME = 'sidebar-layout.json';
/** Per-department page content: General/intranet/departments/{slug}.json */
export const DEPARTMENTS_CONTENT_FOLDER_PATH = 'General/intranet/departments';

const checkGroupMembership = async (msalInstance: any, groupId: string): Promise<boolean> => {
  if (BYPASS_AUTH) return true;

  try {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) return false;

    const activeAccount = accounts[0];
    const graphScopes = ["User.Read", "GroupMember.Read.All"];

    // Silent only: popup races with Lead Generation's Mail.Send popup.
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
    const graphHeaders = {
      Authorization: `Bearer ${accessToken.accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      const checkRes = await fetch('https://graph.microsoft.com/v1.0/me/checkMemberGroups', {
        method: 'POST',
        headers: graphHeaders,
        body: JSON.stringify({ groupIds: [groupId] }),
        signal: controller.signal,
      });

      if (checkRes.ok) {
        const body = await checkRes.json();
        clearTimeout(timeoutId);
        return Array.isArray(body.value) && body.value.includes(groupId);
      }

      type MemberOfPage = {
        value?: Array<{ id?: string }>;
        ['@odata.nextLink']?: string;
      };
      let memberOfUrl: string | null = 'https://graph.microsoft.com/v1.0/me/memberOf';
      while (memberOfUrl) {
        const memberRes: Response = await fetch(memberOfUrl, {
          headers: graphHeaders,
          signal: controller.signal,
        });
        if (!memberRes.ok) {
          clearTimeout(timeoutId);
          return false;
        }
        const memberPage: MemberOfPage = await memberRes.json();
        if (memberPage.value?.some((group) => group.id === groupId)) {
          clearTimeout(timeoutId);
          return true;
        }
        memberOfUrl = memberPage['@odata.nextLink'] ?? null;
      }
      clearTimeout(timeoutId);
      return false;
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

export const isEliteGroupMember = async (msalInstance: any): Promise<boolean> => {
  try {
    return await checkGroupMembership(msalInstance, INTRANET_EXECS_GROUP_ID);
  } catch (error) {
    console.error('Error checking elite group membership:', error);
    return false;
  }
};

export const isEditorGroupMember = async (msalInstance: any): Promise<boolean> => {
  try {
    return await checkGroupMembership(msalInstance, INTRANET_EDITORS_GROUP_ID);
  } catch (error) {
    console.error('Error checking editor group membership:', error);
    return false;
  }
};
