/**
 * contentService.ts
 *
 * Reads and writes editable intranet content from a SharePoint List via the
 * Microsoft Graph API.  All authenticated users can read; only members of the
 * IntranetEditors Azure AD group can write (enforced by SharePoint permissions).
 *
 * Storage model
 * ─────────────
 * Homepage cards (text + metadata) are stored as homepage-cards.json in:
 *   Shared Documents/General/intranet  (SymphonyWirelessTeam site)
 *
 * Announcements are stored as announcements.json in:
 *   Shared Documents/General/intranet
 *
 * Reports metadata is stored as reports.json in:
 *   Shared Documents/General/intranet
 *
 * Sidebar sections, quick links, and site config are stored as:
 *   homepage-sidebar.json, quick-links.json, site-config.json
 *   in Shared Documents/General/intranet
 *
 * Sidebar block order (sections vs quick links) is stored as sidebar-layout.json
 *
 * Card images are stored in:
 *   Shared Documents/General/intranet/images
 *
 * Other content blocks (hero, site-alert, ticker, etc.) use the IntranetContent SharePoint list:
 *   Title       – content key  (e.g. "announcements")
 *   ContentJson – JSON string of the actual data
 */

import {
  BYPASS_AUTH,
  SHAREPOINT_HOST,
  SHAREPOINT_SITE_PATH,
  IMAGE_SHAREPOINT_SITE_PATH,
  IMAGE_SHAREPOINT_FOLDER_PATH,
  INTRANET_CONTENT_FOLDER_PATH,
  CARDS_DATA_FILENAME,
  REPORTS_DATA_FILENAME,
  ANNOUNCEMENTS_DATA_FILENAME,
  SIDEBAR_DATA_FILENAME,
  QUICK_LINKS_DATA_FILENAME,
  SITE_CONFIG_DATA_FILENAME,
  SIDEBAR_LAYOUT_DATA_FILENAME,
} from '../authConfig';
// import seedCards from '../data/homepage-cards.seed.json';

const HOMEPAGE_CARDS_KEY = 'homepage-cards';
const HOMEPAGE_HERO_KEY = 'homepage-hero';
const ANNOUNCEMENTS_CONTENT_KEY = 'announcements';
const REPORTS_CONTENT_KEY = 'reports';
const SIDEBAR_CONTENT_KEY = 'homepage-sidebar';
const QUICK_LINKS_CONTENT_KEY = 'quick-links';
const SITE_CONFIG_CONTENT_KEY = 'site-config';
const SIDEBAR_LAYOUT_CONTENT_KEY = 'sidebar-layout';
/** Previous reports.json location before co-locating with cards in General/intranet */
const LEGACY_REPORTS_FOLDER_PATH = 'General/intranet/reports';

function getDriveContentConfig(key: string): { folderPath: string; fileName: string } | null {
  if (key === HOMEPAGE_CARDS_KEY) {
    return { folderPath: INTRANET_CONTENT_FOLDER_PATH, fileName: CARDS_DATA_FILENAME };
  }
  if (key === ANNOUNCEMENTS_CONTENT_KEY) {
    return { folderPath: INTRANET_CONTENT_FOLDER_PATH, fileName: ANNOUNCEMENTS_DATA_FILENAME };
  }
  if (key === REPORTS_CONTENT_KEY) {
    return { folderPath: INTRANET_CONTENT_FOLDER_PATH, fileName: REPORTS_DATA_FILENAME };
  }
  if (key === SIDEBAR_CONTENT_KEY) {
    return { folderPath: INTRANET_CONTENT_FOLDER_PATH, fileName: SIDEBAR_DATA_FILENAME };
  }
  if (key === QUICK_LINKS_CONTENT_KEY) {
    return { folderPath: INTRANET_CONTENT_FOLDER_PATH, fileName: QUICK_LINKS_DATA_FILENAME };
  }
  if (key === SITE_CONFIG_CONTENT_KEY) {
    return { folderPath: INTRANET_CONTENT_FOLDER_PATH, fileName: SITE_CONFIG_DATA_FILENAME };
  }
  if (key === SIDEBAR_LAYOUT_CONTENT_KEY) {
    return { folderPath: INTRANET_CONTENT_FOLDER_PATH, fileName: SIDEBAR_LAYOUT_DATA_FILENAME };
  }
  return null;
}

const LOCAL_CONTENT_PREFIX = 'intranet-local-content:';

function readLocalContent<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(`${LOCAL_CONTENT_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    console.warn('[contentService] readLocalContent failed:', err);
    return null;
  }
}

/** Synchronous read of the last cached copy (written after each successful load/save). */
export function getCachedContent<T>(key: string): T | null {
  return readLocalContent<T>(key);
}

function writeLocalContent<T>(key: string, data: T): boolean {
  try {
    window.localStorage.setItem(`${LOCAL_CONTENT_PREFIX}${key}`, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn('[contentService] writeLocalContent failed:', err);
    return false;
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CardContent {
  order: number;
  title: string;
  /** Each string in this array renders as one <li>. HTML is allowed (e.g. <a> tags). */
  bullets: string[];
  /** Public image URL.  Empty string → component falls back to its bundled default. */
  imageUrl: string;
  /** Index into LOCAL_IMAGES (1-6) for fallback image. Assigned at creation, persists with card during reorder. */
  imageIndex?: number;
}

/** Bundled snapshot for instant first paint before SharePoint responds. Update src/data/homepage-cards.seed.json from SharePoint when cards change. */
// export const SEED_CARDS: CardContent[] = seedCards as CardContent[];
export const SEED_CARDS: CardContent[] = [];

export interface SidebarSection {
  key: string;
  order: number;
  title: string;
  content: string;
  buttonLabel?: string;
  buttonUrl?: string;
  linkLabel?: string;
  linkUrl?: string;
}

export interface ReportItemContent {
  order: number;
  title: string;
  description: string;
  link: string;
  isEliteOnly: boolean;
  excludedEmails: string[];
}

export interface SiteAlert {
  message: string;
  isActive: boolean;
  /** Visual style of the banner */
  type: 'info' | 'warning' | 'success' | 'error';
  /** Optional CTA link label */
  linkLabel?: string;
  /** Optional CTA link URL */
  linkUrl?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  /** ISO date string */
  date: string;
  isActive: boolean;
}

export interface TickerItem {
  id: string;
  text: string;
  order: number;
}

export interface QuickLink {
  id: string;
  label: string;
  url: string;
  order: number;
}

/** Ordered sidebar blocks — sections and the quick-links group can be interleaved. */
export type SidebarLayoutBlock =
  | { type: 'section'; key: string }
  | { type: 'quick-links' };

export interface SidebarLayout {
  blocks: SidebarLayoutBlock[];
}

export interface SiteConfig {
  supportEmail: string;
  leadGenEmail: string;
  companyName: string;
}

export const DEFAULT_ALERT: SiteAlert = {
  message: '',
  isActive: false,
  type: 'info',
};

export const DEFAULT_ANNOUNCEMENTS: Announcement[] = [];

export const DEFAULT_TICKER_ITEMS: TickerItem[] = [];

// export const DEFAULT_QUICK_LINKS: QuickLink[] = [
//   { id: '1', label: 'Salesforce', url: 'https://symphonyinfra.my.salesforce.com/', order: 1 },
//   { id: '2', label: 'SiteTracker', url: 'https://sitetracker-symphonyinfra.my.salesforce.com/', order: 2 },
//   { id: '3', label: 'Synaptek AI Search', url: 'https://symphonysitesearch.app/', order: 3 },
//   { id: '4', label: 'Trinet', url: 'https://identity.trinet.com/', order: 4 },
//   { id: '5', label: 'Concur', url: 'https://www.concursolutions.com/', order: 5 },
//   { id: '6', label: 'Netsuite', url: 'https://system.netsuite.com/app/center/card.nl?c=8089687', order: 6 },
//   { id: '7', label: 'Outlook', url: 'https://outlook.office.com/', order: 7 },
// ];
export const DEFAULT_QUICK_LINKS: QuickLink[] = [];

// export const DEFAULT_SITE_CONFIG: SiteConfig = {
//   supportEmail: '',
//   leadGenEmail: '',
//   companyName: 'Company Intranet',
// };
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  supportEmail: '',
  leadGenEmail: '',
  companyName: '',
};

// ─── Default content (loaded from SharePoint; no hard-coded sidebar) ─────────

export const DEFAULT_CARDS: CardContent[] = SEED_CARDS;

// export const DEFAULT_SIDEBAR: SidebarSection[] = [
//   {
//     key: 'hr-updates',
//     order: 1,
//     title: 'HR Updates',
//     content:
//       'Please take a moment to fill out this survey below to help us better understand your volunteer interests and organization recommendations.',
//     buttonLabel: 'Volunteer Organization Survey',
//     buttonUrl: 'https://www.surveymonkey.com/r/NKSLSRW',
//   },
//   {
//     key: 'it-updates',
//     order: 2,
//     title: 'IT Updates',
//     content: 'Do not click any phishing links',
//   },
//   {
//     key: 'exciting-news',
//     order: 3,
//     title: 'Exciting News',
//     content:
//       'Palistar Capital combines Symphony Wireless with CTI Towers to form Symphony Towers Infrastructure (Symphony Towers). Read the <a href="https://www.prnewswire.com/news-releases/palistar-capital-announces-combination-of-us-wireless-assets-302350144.html" target="_blank" rel="noopener noreferrer">Press Release</a>.',
//   },
//   {
//     key: 'holiday-photos',
//     order: 4,
//     title: '2025 Holiday Party Photos',
//     content:
//       'Linked below are the photos from our annual Holiday Party! Please browse when you have some time!',
//     linkLabel: 'Holiday Party 2025',
//     linkUrl:
//       'https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FHoliday%20Party%202025&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd',
//   },
// ];
export const DEFAULT_SIDEBAR: SidebarSection[] = [];

// export const DEFAULT_REPORTS: ReportItemContent[] = [
//   { order: 1, title: 'Company Progress', description: 'A comprehensive view of company performance metrics and progress indicators.', link: 'https://app.powerbi.com/reportEmbed?reportId=e091da31-91dd-42c2-9b17-099d2e07c492&autoAuth=true&ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&filterPaneEnabled=false&navContentPaneEnabled=false', isEliteOnly: false, excludedEmails: [] },
//   { order: 2, title: 'All Acquisitions Summary', description: 'A comprehensive look at All Symphony Towers Infrastructure Acquisitions broken down by month, quarter, and year.', link: 'https://app.powerbi.com/links/PDJWKnYPlL?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
//   { order: 3, title: 'Daily Opportunity Count', description: 'A comprehensive status report on all current Symphony Towers Infrastructure Opportunities, Term Sheets, and Closed Rent.', link: 'https://app.powerbi.com/links/cJsxxPeDQx?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
//   { order: 4, title: 'Portfolio Pipeline', description: 'A comprehensive look at the Symphony Towers Infrastructure Portfolio pipeline.', link: 'https://app.powerbi.com/links/EJYOMILU2S?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
//   { order: 5, title: 'Tower Purchase Opportunities', description: 'A complete view of all opportunities with the Tower Purchase transaction type.', link: 'https://app.powerbi.com/links/15otqb7SY1?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
//   { order: 6, title: 'Closing - Pipeline', description: 'A comprehensive look at the Symphony Towers Infrastructure Closing Pipeline.', link: 'https://app.powerbi.com/links/Cs4H7e-pez?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
//   { order: 7, title: 'Signed LOIs - SNDA', description: 'A comprehensive look at Signed Letters of Intent and SNDA agreements.', link: 'https://app.powerbi.com/links/M87CTzygq_?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
//   { order: 8, title: 'Daily Acquisitions Summary', description: 'A comprehensive look at the Symphony Towers Infrastructure Daily Acquisitions.', link: 'https://app.powerbi.com/links/hMDIVOJ44O?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
//   { order: 9, title: 'Underwriting Reports', description: 'Ad-hoc reports for Underwriting Team i.e. Broker Pipeline', link: 'https://app.powerbi.com/links/1fRk37tWhP?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
//   { order: 10, title: 'Site Analysis', description: 'Analysis of the site data', link: 'https://app.powerbi.com/links/isIvWaCuac?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
//   { order: 11, title: 'WIP - In-Month Conversion Tracker', description: 'Work In Progress - A tracker to view opportunity conversions by month.', link: '', isEliteOnly: false, excludedEmails: [] },
//   { order: 12, title: 'WIP - TS and CR Trends Report', description: 'Work In Progress - A comprehensive look at trends in Term Sheets and Closed Rent.', link: '', isEliteOnly: false, excludedEmails: [] },
//   { order: 13, title: 'TK Salesforce Sites', description: 'A comprehensive look at TK High Rent Relocation Sites and their status.', link: 'https://app.powerbi.com/links/ArNJaolb9U?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
//   { order: 14, title: 'Elite - Origination Pipeline', description: 'A comprehensive look at the Symphony Towers Infrastructure Origination Pipeline.', link: 'https://app.powerbi.com/links/lUwfP_rkT6?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: true, excludedEmails: ['arivera@symphonyinfra.com'] },
//   { order: 15, title: 'Elite - Company Progress', description: 'A complete view of current GCF and Capital Acquisition activity.', link: 'https://app.powerbi.com/groups/me/reports/e091da31-91dd-42c2-9b17-099d2e07c492/2695a41c69787864795c?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4', isEliteOnly: true, excludedEmails: ['arivera@symphonyinfra.com'] },
//   { order: 16, title: 'Elite - Scorecard Pipeline', description: 'A comprehensive look at the Symphony Towers Infrastructure Scorecard Pipeline.', link: 'https://app.powerbi.com/links/q75bs_ZEe2?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: true, excludedEmails: ['arivera@symphonyinfra.com'] },
//   { order: 17, title: 'Elite - Acquisition Team Commission Report', description: 'A comprehensive look at the Symphony Towers Infrastructure Acquisition Team Commission Breakdown.', link: 'https://app.powerbi.com/links/yGE8PseRVw?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: true, excludedEmails: ['jcymbalista@symphonyinfra.com', 'cdolgon@symphonyinfra.com'] },
// ];
export const DEFAULT_REPORTS: ReportItemContent[] = [];

// ─── Internal Graph helpers ───────────────────────────────────────────────────

const CONTENT_LIST_NAME = 'IntranetContent';

const _siteIds: Record<string, string | null> = {};
let _listId: string | null = null;
let _contentJsonFieldName: string | null = null;

async function ensureContentJsonColumn(siteId: string, listId: string, token: string): Promise<void> {
  const columnsRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!columnsRes.ok) return;

  const columnsData = await columnsRes.json();
  const existing = columnsData.value?.find(
    (col: { name?: string; displayName?: string }) =>
      col.name === 'ContentJson' || col.displayName === 'ContentJson'
  );
  if (existing?.name) {
    _contentJsonFieldName = existing.name;
    return;
  }

  const createColRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'ContentJson',
        text: { allowMultipleLines: true, allowTextOverflow: true },
      }),
    }
  );
  if (createColRes.ok) {
    const created = await createColRes.json();
    _contentJsonFieldName = created.name || 'ContentJson';
  }
}

async function resolveContentJsonFieldName(siteId: string, listId: string, token: string): Promise<string> {
  if (_contentJsonFieldName) return _contentJsonFieldName;
  await ensureContentJsonColumn(siteId, listId, token);
  return _contentJsonFieldName || 'ContentJson';
}

async function getToken(msalInstance: any): Promise<string | null> {
  try {
    const accounts = msalInstance.getAllAccounts();
    if (!accounts.length) return null;

    const tokenRequest = {
      scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite.All'],
      account: accounts[0],
    };

    try {
      const result = await msalInstance.acquireTokenSilent(tokenRequest);
      return result.accessToken;
    } catch (silentError) {
      console.warn('[contentService] acquireTokenSilent failed, trying popup fallback', silentError);
      if (typeof msalInstance.acquireTokenPopup === 'function') {
        try {
          const result = await msalInstance.acquireTokenPopup(tokenRequest);
          return result.accessToken;
        } catch (popupError) {
          console.error('[contentService] acquireTokenPopup failed:', popupError);
          return null;
        }
      }
      return null;
    }
  } catch (err) {
    console.error('[contentService] getToken failed:', err);
    return null;
  }
}

async function getSiteId(token: string, sitePath: string): Promise<string> {
  if (_siteIds[sitePath]) return _siteIds[sitePath] as string;
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_HOST}:${sitePath}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`getSiteId failed: ${res.status}`);
  const data = await res.json();
  _siteIds[sitePath] = data.id as string;
  return _siteIds[sitePath] as string;
}

async function getOrCreateList(siteId: string, token: string): Promise<string> {
  if (_listId) return _listId;

  // Try to find existing list
  const listRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$filter=displayName eq '${CONTENT_LIST_NAME}'&$select=id,displayName`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (listRes.ok) {
    const listData = await listRes.json();
    if (listData.value?.length > 0) {
      _listId = listData.value[0].id as string;
      return _listId;
    }
  }

  // Create the list with a ContentJson multi-line text column
  const createRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: CONTENT_LIST_NAME,
        columns: [
          { name: 'ContentJson', text: { allowMultipleLines: true, allowTextOverflow: true } },
        ],
        list: { template: 'genericList' },
      }),
    }
  );
  if (!createRes.ok) throw new Error(`createList failed: ${createRes.status}`);
  const created = await createRes.json();
  _listId = created.id as string;
  return _listId;
}

async function findListItemId(
  siteId: string,
  listId: string,
  token: string,
  key: string
): Promise<string | null> {
  const escapedKey = key.replace(/'/g, "''");
  const filterRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$filter=fields/Title eq '${escapedKey}'&$select=id`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (filterRes.ok) {
    const filterData = await filterRes.json();
    if (filterData.value?.length > 0) {
      return filterData.value[0].id as string;
    }
  } else {
    const filterErr = await filterRes.text().catch(() => '');
    console.warn(`[contentService] list filter failed for "${key}": ${filterRes.status} ${filterErr}`);
  }

  // Fallback when indexed $filter is unavailable or returns no rows
  type ListItemPage = {
    value?: Array<{ id?: string; fields?: { Title?: string } }>;
    ['@odata.nextLink']?: string;
  };

  let nextUrl: string | null =
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$expand=fields($select=Title)&$select=id,fields&$top=100`;

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[contentService] list scan failed for "${key}": ${res.status} ${errText}`);
      break;
    }
    const page: ListItemPage = await res.json();
    const match = page.value?.find((item: { fields?: { Title?: string } }) => item.fields?.Title === key);
    if (match?.id) return match.id as string;
    nextUrl = page['@odata.nextLink'] ?? null;
  }

  return null;
}

async function persistContentToSharePoint<T>(
  siteId: string,
  listId: string,
  token: string,
  key: string,
  data: T
): Promise<boolean> {
  const contentJson = JSON.stringify(data);
  const fieldName = await resolveContentJsonFieldName(siteId, listId, token);
  const itemId = await findListItemId(siteId, listId, token, key);

  if (itemId) {
    const patchRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}/fields`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldName]: contentJson }),
      }
    );
    if (patchRes.ok) return true;
    const patchErr = await patchRes.text().catch(() => '');
    console.error(`[contentService] PATCH "${key}" failed: ${patchRes.status} ${patchErr}`);
    return false;
  }

  const createRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { Title: key, [fieldName]: contentJson } }),
    }
  );
  if (createRes.ok) return true;
  const createErr = await createRes.text().catch(() => '');
  console.error(`[contentService] CREATE "${key}" failed: ${createRes.status} ${createErr}`);
  return false;
}

// ─── Image upload ─────────────────────────────────────────────────────────────

async function ensureDriveFolderPath(siteId: string, token: string, folderPath: string): Promise<void> {
  const checkRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${folderPath}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (checkRes.ok) return;
  if (checkRes.status !== 404) {
    throw new Error(`Could not verify drive folder "${folderPath}": ${checkRes.status}`);
  }

  const parts = folderPath.split('/').filter(Boolean);
  let builtPath = '';
  for (const part of parts) {
    const parentPath = builtPath;
    builtPath = builtPath ? `${builtPath}/${part}` : part;

    const existsRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${builtPath}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (existsRes.ok) continue;

    const createUrl = parentPath
      ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${parentPath}:/children`
      : `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: part,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'replace',
      }),
    });
    if (!createRes.ok) {
      throw new Error(`Could not create drive folder "${builtPath}": ${createRes.status}`);
    }
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader result was not a string'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

async function fetchImageAsFile(msalInstance: any, imageUrl: string): Promise<File | null> {
  try {
    let blob: Blob;
    let contentType = 'application/octet-stream';

    if (isSharePointImageUrl(imageUrl)) {
      const blobUrl = await getSharePointImageBlobUrl(msalInstance, imageUrl);
      if (!blobUrl) return null;
      const response = await fetch(blobUrl);
      if (!response.ok) return null;
      contentType = response.headers.get('content-type') || contentType;
      blob = await response.blob();
    } else {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`[contentService] fetchImageAsFile failed: ${response.status} ${response.statusText}`);
        return null;
      }
      contentType = response.headers.get('content-type') || contentType;
      blob = await response.blob();
    }

    let filename = new URL(imageUrl).pathname.split('/').pop() || `image-${Date.now()}`;
    if (!filename.includes('.')) {
      const extension = contentType.split('/')[1]?.split(';')[0] || 'jpg';
      filename = `${filename}.${extension}`;
    }
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return new File([blob], filename, { type: contentType });
  } catch (err) {
    console.error('[contentService] fetchImageAsFile failed:', err);
    return null;
  }
}

const sharePointImageBlobCache = new Map<string, Promise<string | null>>();
const sharePointImageResolvedCache = new Map<string, string>();
const SHAREPOINT_IMAGE_CACHE_PREFIX = 'intranet-sp-img:';

function readPersistentImageCache(webUrl: string): string | null {
  const key = `${SHAREPOINT_IMAGE_CACHE_PREFIX}${webUrl}`;
  try {
    const local = localStorage.getItem(key);
    if (local) return local;
  } catch {
    // ignore
  }
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePersistentImageCache(webUrl: string, dataUrl: string): void {
  const key = `${SHAREPOINT_IMAGE_CACHE_PREFIX}${webUrl}`;
  try {
    localStorage.setItem(key, dataUrl);
    return;
  } catch (err) {
    console.warn('[contentService] local image cache write failed:', err);
  }
  try {
    sessionStorage.setItem(key, dataUrl);
  } catch (err) {
    console.warn('[contentService] session image cache write failed:', err);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Synchronous lookup for a previously fetched SharePoint image (session or in-memory). */
export function getCachedSharePointImageUrl(webUrl: string): string | null {
  if (!webUrl) return null;
  if (!isSharePointImageUrl(webUrl)) return webUrl;
  const resolved = sharePointImageResolvedCache.get(webUrl);
  if (resolved) return resolved;
  const session = readPersistentImageCache(webUrl);
  if (session) {
    sharePointImageResolvedCache.set(webUrl, session);
    return session;
  }
  return null;
}

export function isSharePointImageUrl(url: string): boolean {
  if (!url || url.startsWith('data:')) return false;
  return /sharepoint/i.test(url) || url.includes('graph.microsoft.com');
}

function webUrlToDrivePath(webUrl: string): string | null {
  try {
    const pathname = decodeURIComponent(new URL(webUrl).pathname);
    const match = pathname.match(/\/Shared Documents\/(.+)$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function encodeSharePointUrlForGraph(webUrl: string): string {
  const base64 = btoa(webUrl);
  return `u!${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

async function fetchSharePointImageBlob(msalInstance: any, webUrl: string): Promise<Blob | null> {
  const token = await getToken(msalInstance);
  if (!token) return null;

  const drivePath = webUrlToDrivePath(webUrl);
  if (drivePath) {
    const siteId = await getSiteId(token, IMAGE_SHAREPOINT_SITE_PATH);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${drivePath}:/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) return res.blob();
    const err = await res.text().catch(() => '');
    console.warn(`[contentService] SharePoint image fetch failed (${res.status}):`, drivePath, err);
  }

  const shareId = encodeSharePointUrlForGraph(webUrl);
  const shareRes = await fetch(
    `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!shareRes.ok) {
    const err = await shareRes.text().catch(() => '');
    console.warn(`[contentService] SharePoint shares image fetch failed (${shareRes.status}):`, webUrl, err);
    return null;
  }
  return shareRes.blob();
}

async function fetchSharePointImageBlobUrl(msalInstance: any, webUrl: string): Promise<string | null> {
  const blob = await fetchSharePointImageBlob(msalInstance, webUrl);
  if (!blob) return null;

  const dataUrl = await blobToDataUrl(blob);
  sharePointImageResolvedCache.set(webUrl, dataUrl);
  writePersistentImageCache(webUrl, dataUrl);
  return dataUrl;
}

/** Fetch a SharePoint-hosted image with the user's Graph token; returns a blob URL. */
export async function getSharePointImageBlobUrl(
  msalInstance: any,
  webUrl: string
): Promise<string | null> {
  if (!webUrl) return null;
  if (!isSharePointImageUrl(webUrl)) return webUrl;

  const resolved = getCachedSharePointImageUrl(webUrl);
  if (resolved) return resolved;

  const cached = sharePointImageBlobCache.get(webUrl);
  if (cached) return cached;

  const pending = fetchSharePointImageBlobUrl(msalInstance, webUrl);
  sharePointImageBlobCache.set(webUrl, pending);
  return pending;
}

/** Collect SharePoint image URLs from cached/seed homepage content for boot-time warmup. */
export function collectHomepageImageUrls(): string[] {
  const cachedCards = getCachedContent<CardContent[]>(HOMEPAGE_CARDS_KEY);
  const cards = cachedCards?.length ? cachedCards : SEED_CARDS;
  const urls: string[] = [];
  for (const card of cards) {
    if (card.imageUrl) urls.push(card.imageUrl);
  }
  const hero = getCachedContent<string>(HOMEPAGE_HERO_KEY);
  if (hero) urls.push(hero);
  return urls.filter((url) => isSharePointImageUrl(url));
}

/**
 * Fetch homepage SharePoint images during app boot so the homepage paints from cache.
 * Resolves immediately when every URL is already cached.
 */
export async function warmHomepageImageCache(msalInstance: any): Promise<void> {
  if (!BYPASS_AUTH && msalInstance.getAllAccounts().length === 0) return;

  const urls = collectHomepageImageUrls();
  const uncached = urls.filter((url) => !getCachedSharePointImageUrl(url));
  if (uncached.length === 0) return;

  await Promise.all(
    uncached.map((url) => getSharePointImageBlobUrl(msalInstance, url))
  );
}

/** Start authenticated SharePoint image fetches early so components hit the cache. */
export function preloadSharePointImages(msalInstance: any, urls: Array<string | undefined | null>): void {
  const unique = Array.from(
    new Set(urls.filter((url): url is string => !!url && isSharePointImageUrl(url)))
  );
  unique.forEach((url) => {
    void getSharePointImageBlobUrl(msalInstance, url);
  });
}

export async function uploadImageFromUrl(msalInstance: any, imageUrl: string): Promise<string | null> {
  if (!imageUrl || imageUrl.startsWith('data:')) return null;
  const file = await fetchImageAsFile(msalInstance, imageUrl);
  if (!file) return null;
  return uploadImage(msalInstance, file);
}

/**
 * Upload an image file to Shared Documents/General/intranet/images on the
 * SymphonyWirelessTeam site. Returns the permanent SharePoint webUrl on success.
 */
export async function uploadImage(msalInstance: any, file: File): Promise<string | null> {
  if (BYPASS_AUTH) {
    try {
      return await fileToDataUrl(file);
    } catch (err) {
      console.error('[contentService] uploadImage bypass fallback failed:', err);
      return null;
    }
  }

  try {
    const token = await getToken(msalInstance);
    if (!token) {
      console.error('[contentService] uploadImage: no token acquired');
      return null;
    }

    const siteId = await getSiteId(token, IMAGE_SHAREPOINT_SITE_PATH);
    await ensureDriveFolderPath(siteId, token, IMAGE_SHAREPOINT_FOLDER_PATH);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}-${safeName}`;
    const uploadPath = `${IMAGE_SHAREPOINT_FOLDER_PATH}/${filename}`;
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${uploadPath}:/content`;

    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unable to read error body');
      console.error(`[contentService] uploadImage failed: ${res.status} ${res.statusText} - ${errorText}`);
      return null;
    }

    const item = await res.json();
    if (!item?.id) {
      console.error('[contentService] uploadImage did not return item id', item);
      return null;
    }

    try {
      const infoRes = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${item.id}?$select=@microsoft.graph.downloadUrl,webUrl`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (infoRes.ok) {
        const info = await infoRes.json();
        if (info?.webUrl) {
          return info.webUrl as string;
        }
        if (info?.['@microsoft.graph.downloadUrl']) {
          return info['@microsoft.graph.downloadUrl'] as string;
        }
      } else {
        console.warn('[contentService] uploadImage metadata fetch failed', infoRes.status, infoRes.statusText);
      }
    } catch (infoErr) {
      console.error('[contentService] uploadImage metadata fetch error:', infoErr);
    }

    if (!item?.webUrl) {
      console.error('[contentService] uploadImage did not return webUrl', item);
      return null;
    }

    return item.webUrl as string;
  } catch (err) {
    console.error('[contentService] uploadImage error:', err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function readContentFromSharePointDrive<T>(
  siteId: string,
  token: string,
  fileName: string,
  folderPath: string = INTRANET_CONTENT_FOLDER_PATH
): Promise<T | null> {
  const filePath = `${folderPath}/${fileName}`;
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${filePath}:/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.warn(`[contentService] read drive file "${filePath}" failed: ${res.status} ${err}`);
    return null;
  }
  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as T;
}

async function getDriveItemByPath(
  siteId: string,
  token: string,
  filePath: string
): Promise<{ id: string } | null> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${filePath}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id ? { id: data.id as string } : null;
}

async function putDriveFileContent(
  siteId: string,
  token: string,
  uploadUrl: string,
  body: string
): Promise<Response> {
  return fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body,
  });
}

async function writeContentToSharePointDrive<T>(
  siteId: string,
  token: string,
  fileName: string,
  data: T,
  folderPath: string = INTRANET_CONTENT_FOLDER_PATH
): Promise<boolean> {
  await ensureDriveFolderPath(siteId, token, folderPath);
  const filePath = `${folderPath}/${fileName}`;
  const jsonBody = JSON.stringify(data, null, 2);

  const existing = await getDriveItemByPath(siteId, token, filePath);

  if (existing) {
    const itemContentUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${existing.id}/content`;
    let res = await putDriveFileContent(siteId, token, itemContentUrl, jsonBody);

    if (res.ok) return true;

    const err = await res.text().catch(() => '');
    console.warn(
      `[contentService] drive item update failed (${res.status}), trying delete/recreate:`,
      err
    );

    const deleteRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${existing.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    );
    if (!deleteRes.ok && deleteRes.status !== 404) {
      console.error(
        `[contentService] could not delete drive file "${filePath}" for recreate: ${deleteRes.status}`
      );
      return false;
    }
  }

  const createUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${filePath}:/content`;
  const createRes = await putDriveFileContent(siteId, token, createUrl, jsonBody);
  if (!createRes.ok) {
    const err = await createRes.text().catch(() => '');
    console.error(
      `[contentService] write drive file "${filePath}" failed: ${createRes.status} ${err}`
    );
    return false;
  }
  return true;
}

export interface ContentSyncOptions {
  /** Use SharePoint only — skip browser-local fallback (for cross-device sync). */
  remoteOnly?: boolean;
}

async function readContentFromSharePoint<T>(
  siteId: string,
  listId: string,
  token: string,
  key: string
): Promise<T | null> {
  const itemId = await findListItemId(siteId, listId, token, key);
  if (!itemId) return null;

  const fieldName = await resolveContentJsonFieldName(siteId, listId, token);
  const itemRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}?$expand=fields&$select=fields`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!itemRes.ok) return null;

  const itemData = await itemRes.json();
  const json = itemData.fields?.[fieldName] ?? itemData.fields?.ContentJson;
  if (!json) return null;
  return JSON.parse(json) as T;
}

async function fetchContentFromRemote<T>(
  msalInstance: any,
  key: string
): Promise<T | null> {
  try {
    const token = await getToken(msalInstance);
    if (!token) return null;

    const siteId = await getSiteId(token, SHAREPOINT_SITE_PATH);

    const driveConfig = getDriveContentConfig(key);
    if (driveConfig) {
      const driveParsed = await readContentFromSharePointDrive<T>(
        siteId,
        token,
        driveConfig.fileName,
        driveConfig.folderPath
      );
      if (driveParsed) {
        writeLocalContent(key, driveParsed);
        return driveParsed;
      }

      if (key === REPORTS_CONTENT_KEY) {
        const legacyParsed = await readContentFromSharePointDrive<T>(
          siteId,
          token,
          REPORTS_DATA_FILENAME,
          LEGACY_REPORTS_FOLDER_PATH
        );
        if (legacyParsed) {
          await writeContentToSharePointDrive(
            siteId,
            token,
            driveConfig.fileName,
            legacyParsed,
            driveConfig.folderPath
          );
          writeLocalContent(key, legacyParsed);
          return legacyParsed;
        }
      }

      const listId = await getOrCreateList(siteId, token);
      const listParsed = await readContentFromSharePoint<T>(siteId, listId, token, key);
      if (listParsed) {
        await writeContentToSharePointDrive(
          siteId,
          token,
          driveConfig.fileName,
          listParsed,
          driveConfig.folderPath
        );
        writeLocalContent(key, listParsed);
        return listParsed;
      }

      return null;
    }

    const listId = await getOrCreateList(siteId, token);
    const parsed = await readContentFromSharePoint<T>(siteId, listId, token, key);

    if (parsed) {
      writeLocalContent(key, parsed);
      return parsed;
    }
    return null;
  } catch (err) {
    console.error(`[contentService] fetchContentFromRemote("${key}") failed:`, err);
    return null;
  }
}

/**
 * Read a content block.  Returns null if SharePoint is unreachable or the item
 * has not been saved yet (callers should fall back to their DEFAULT_* constant).
 *
 * When browser cache exists, returns it immediately and refreshes SharePoint in
 * the background (unless remoteOnly is set).
 */
export async function getContent<T>(
  msalInstance: any,
  key: string,
  options?: ContentSyncOptions
): Promise<T | null> {
  if (BYPASS_AUTH) {
    return readLocalContent<T>(key);
  }

  const cached = readLocalContent<T>(key);

  if (!options?.remoteOnly && cached !== null) {
    void fetchContentFromRemote<T>(msalInstance, key);
    return cached;
  }

  const remote = await fetchContentFromRemote<T>(msalInstance, key);
  if (remote !== null) return remote;

  return options?.remoteOnly ? null : cached;
}

export interface SetContentResult {
  ok: boolean;
  storage: 'sharepoint' | 'local' | 'none';
}

/**
 * Write a content block back to SharePoint.  Returns true on success.
 */
export async function setContent<T>(
  msalInstance: any,
  key: string,
  data: T,
  options?: ContentSyncOptions
): Promise<boolean> {
  const result = await setContentDetailed(msalInstance, key, data, options);
  return result.ok;
}

export async function setContentDetailed<T>(
  msalInstance: any,
  key: string,
  data: T,
  options?: ContentSyncOptions
): Promise<SetContentResult> {
  if (BYPASS_AUTH) {
    const ok = writeLocalContent(key, data);
    return { ok, storage: ok ? 'local' : 'none' };
  }

  try {
    const token = await getToken(msalInstance);
    if (!token) throw new Error('Could not acquire SharePoint token. Ensure Sites.ReadWrite.All has been admin-consented.');

    const siteId = await getSiteId(token, SHAREPOINT_SITE_PATH);

    const driveConfig = getDriveContentConfig(key);
    if (driveConfig) {
      const driveOk = await writeContentToSharePointDrive(
        siteId,
        token,
        driveConfig.fileName,
        data,
        driveConfig.folderPath
      );
      if (driveOk) {
        writeLocalContent(key, data);
        return { ok: true, storage: 'sharepoint' };
      }

      // Fallback: legacy IntranetContent list (keeps cross-device sync if drive write is blocked)
      const listId = await getOrCreateList(siteId, token);
      await ensureContentJsonColumn(siteId, listId, token);
      const listOk = await persistContentToSharePoint(siteId, listId, token, key, data);
      if (listOk) {
        writeLocalContent(key, data);
        console.warn(
          `[contentService] setContent("${key}") saved to IntranetContent list (drive file write failed)`
        );
        return { ok: true, storage: 'sharepoint' };
      }
    } else {
      const listId = await getOrCreateList(siteId, token);
      await ensureContentJsonColumn(siteId, listId, token);
      const sharePointOk = await persistContentToSharePoint(siteId, listId, token, key, data);

      if (sharePointOk) {
        writeLocalContent(key, data);
        return { ok: true, storage: 'sharepoint' };
      }
    }
  } catch (err) {
    console.error(`[contentService] setContent("${key}") failed:`, err);
  }

  if (options?.remoteOnly) {
    return { ok: false, storage: 'none' };
  }

  const localOk = writeLocalContent(key, data);
  if (localOk) {
    console.warn(`[contentService] setContent("${key}") saved to browser storage (SharePoint write failed)`);
    return { ok: true, storage: 'local' };
  }
  return { ok: false, storage: 'none' };
}
