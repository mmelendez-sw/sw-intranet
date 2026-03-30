/**
 * contentService.ts
 *
 * Reads and writes editable intranet content from a SharePoint List via the
 * Microsoft Graph API.  All authenticated users can read; only members of the
 * IntranetEditors Azure AD group can write (enforced by SharePoint permissions).
 *
 * Storage model
 * ─────────────
 * One SharePoint list called "IntranetContent" on the SymphonyWirelessTeam site.
 * Each list item stores one content block:
 *   Title       – content key  (e.g. "homepage-cards")
 *   ContentJson – JSON string of the actual data
 *
 * Content keys:   "homepage-cards" | "homepage-sidebar" | "reports"
 */

import { SHAREPOINT_HOST, SHAREPOINT_SITE_PATH } from '../authConfig';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CardContent {
  order: number;
  title: string;
  /** Each string in this array renders as one <li>. HTML is allowed (e.g. <a> tags). */
  bullets: string[];
  /** Public image URL.  Empty string → component falls back to its bundled default. */
  imageUrl: string;
}

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

export const DEFAULT_QUICK_LINKS: QuickLink[] = [
  { id: '1', label: 'Salesforce', url: 'https://symphonyinfra.my.salesforce.com/', order: 1 },
  { id: '2', label: 'SiteTracker', url: 'https://sitetracker-symphonyinfra.my.salesforce.com/', order: 2 },
  { id: '3', label: 'Synaptek AI Search', url: 'https://symphonysitesearch.app/', order: 3 },
  { id: '4', label: 'Trinet', url: 'https://identity.trinet.com/', order: 4 },
  { id: '5', label: 'Concur', url: 'https://www.concursolutions.com/', order: 5 },
  { id: '6', label: 'Netsuite', url: 'https://system.netsuite.com/app/center/card.nl?c=8089687', order: 6 },
  { id: '7', label: 'Outlook', url: 'https://outlook.office.com/', order: 7 },
];

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  supportEmail: '',
  leadGenEmail: '',
  companyName: 'Company Intranet',
};

// ─── Default content (mirrors current hard-coded values) ─────────────────────

export const DEFAULT_CARDS: CardContent[] = [
  {
    order: 1,
    title: 'Important Dates',
    bullets: [
      'April - Q1 Performance Reviews',
      '4/3: Good Friday',
      '5/25: Memorial Day',
      '6/19: Juneteenth',
      'July - Q2 Performance Reviews',
      '7/3: Independence Day Observed',
    ],
    imageUrl: '',
  },
  {
    order: 2,
    title: 'Hidden Talents',
    bullets: ['A fun-filled Paint &amp; Sip that brought the team together.'],
    imageUrl: '',
  },
  {
    order: 3,
    title: 'March Madness',
    bullets: [
      'Thank you to everyone who came out to Buffalo Wild Wings for our March Madness event! It was a great time cheering on our brackets together.',
      'We hope everyone enjoyed the food, fun, and team spirit. Looking forward to more events like this!',
    ],
    imageUrl: '',
  },
  {
    order: 4,
    title: 'Person to Person Coat Drive',
    bullets: [
      'Thank you to our volunteers who joined us for the Person to Person coat drive in Darien, CT! Your kindness keeps our community warm.',
    ],
    imageUrl: '',
  },
  {
    order: 5,
    title: 'Marketing Updates',
    bullets: [
      "We're excited to share that our company logo has been updated as part of our ongoing brand refresh. A shared folder with updated logo files, templates, and brand collateral has been created. Questions? Reach out to Justin or Arwa.",
      '<a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?csf=1&web=1&e=XUzv8z&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FMarketing&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd" target="_blank" rel="noopener noreferrer">New Symphony Branding</a>',
      'Linked below are marketing reports from our Inside Towers company subscription and a link to their most recent quarterly briefing.',
      '<a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?csf=1&web=1&e=XUzv8z&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FMarketing%2FInside%20Towers%20Market%20Reports&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd" target="_blank" rel="noopener noreferrer">Inside Towers Market Reports</a>',
      '<a href="https://www.youtube.com/watch?v=eg2OMjNgtHg" target="_blank" rel="noopener noreferrer">Inside Towers Quarterly Briefing</a>',
    ],
    imageUrl: '',
  },
  {
    order: 6,
    title: 'Employee Appreciation Day Celebration',
    bullets: [
      'Thank you to every team member for your dedication, positive energy, and hard work — your contributions are the reason our Employee Appreciation Day was such a success.',
    ],
    imageUrl: '',
  },
];

export const DEFAULT_SIDEBAR: SidebarSection[] = [
  {
    key: 'hr-updates',
    order: 1,
    title: 'HR Updates',
    content:
      'Please take a moment to fill out this survey below to help us better understand your volunteer interests and organization recommendations.',
    buttonLabel: 'Volunteer Organization Survey',
    buttonUrl: 'https://www.surveymonkey.com/r/NKSLSRW',
  },
  {
    key: 'it-updates',
    order: 2,
    title: 'IT Updates',
    content: 'Do not click any phishing links',
  },
  {
    key: 'exciting-news',
    order: 3,
    title: 'Exciting News',
    content:
      'Palistar Capital combines Symphony Wireless with CTI Towers to form Symphony Towers Infrastructure (Symphony Towers). Read the <a href="https://www.prnewswire.com/news-releases/palistar-capital-announces-combination-of-us-wireless-assets-302350144.html" target="_blank" rel="noopener noreferrer">Press Release</a>.',
  },
  {
    key: 'holiday-photos',
    order: 4,
    title: '2025 Holiday Party Photos',
    content:
      'Linked below are the photos from our annual Holiday Party! Please browse when you have some time!',
    linkLabel: 'Holiday Party 2025',
    linkUrl:
      'https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FHoliday%20Party%202025&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd',
  },
];

export const DEFAULT_REPORTS: ReportItemContent[] = [
  { order: 1, title: 'Company Progress', description: 'A comprehensive view of company performance metrics and progress indicators.', link: 'https://app.powerbi.com/reportEmbed?reportId=e091da31-91dd-42c2-9b17-099d2e07c492&autoAuth=true&ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&filterPaneEnabled=false&navContentPaneEnabled=false', isEliteOnly: false, excludedEmails: [] },
  { order: 2, title: 'All Acquisitions Summary', description: 'A comprehensive look at All Symphony Towers Infrastructure Acquisitions broken down by month, quarter, and year.', link: 'https://app.powerbi.com/links/PDJWKnYPlL?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
  { order: 3, title: 'Daily Opportunity Count', description: 'A comprehensive status report on all current Symphony Towers Infrastructure Opportunities, Term Sheets, and Closed Rent.', link: 'https://app.powerbi.com/links/cJsxxPeDQx?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
  { order: 4, title: 'Portfolio Pipeline', description: 'A comprehensive look at the Symphony Towers Infrastructure Portfolio pipeline.', link: 'https://app.powerbi.com/links/EJYOMILU2S?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
  { order: 5, title: 'Tower Purchase Opportunities', description: 'A complete view of all opportunities with the Tower Purchase transaction type.', link: 'https://app.powerbi.com/links/15otqb7SY1?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
  { order: 6, title: 'Closing - Pipeline', description: 'A comprehensive look at the Symphony Towers Infrastructure Closing Pipeline.', link: 'https://app.powerbi.com/links/Cs4H7e-pez?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
  { order: 7, title: 'Signed LOIs - SNDA', description: 'A comprehensive look at Signed Letters of Intent and SNDA agreements.', link: 'https://app.powerbi.com/links/M87CTzygq_?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
  { order: 8, title: 'Daily Acquisitions Summary', description: 'A comprehensive look at the Symphony Towers Infrastructure Daily Acquisitions.', link: 'https://app.powerbi.com/links/hMDIVOJ44O?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
  { order: 9, title: 'WIP - In-Month Conversion Tracker', description: 'Work In Progress - A tracker to view opportunity conversions by month.', link: '', isEliteOnly: false, excludedEmails: [] },
  { order: 10, title: 'WIP - TS and CR Trends Report', description: 'Work In Progress - A comprehensive look at trends in Term Sheets and Closed Rent.', link: '', isEliteOnly: false, excludedEmails: [] },
  { order: 11, title: 'TK Salesforce Sites', description: 'A comprehensive look at TK High Rent Relocation Sites and their status.', link: 'https://app.powerbi.com/links/ArNJaolb9U?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: false, excludedEmails: [] },
  { order: 12, title: 'Elite - Origination Pipeline', description: 'A comprehensive look at the Symphony Towers Infrastructure Origination Pipeline.', link: 'https://app.powerbi.com/links/lUwfP_rkT6?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: true, excludedEmails: ['arivera@symphonyinfra.com'] },
  { order: 13, title: 'Elite - Company Progress', description: 'A complete view of current GCF and Capital Acquisition activity.', link: 'https://app.powerbi.com/groups/me/reports/e091da31-91dd-42c2-9b17-099d2e07c492/2695a41c69787864795c?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4', isEliteOnly: true, excludedEmails: ['arivera@symphonyinfra.com'] },
  { order: 14, title: 'Elite - Scorecard Pipeline', description: 'A comprehensive look at the Symphony Towers Infrastructure Scorecard Pipeline.', link: 'https://app.powerbi.com/links/q75bs_ZEe2?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: true, excludedEmails: ['arivera@symphonyinfra.com'] },
  { order: 15, title: 'Elite - Acquisition Team Commission Report', description: 'A comprehensive look at the Symphony Towers Infrastructure Acquisition Team Commission Breakdown.', link: 'https://app.powerbi.com/links/yGE8PseRVw?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare', isEliteOnly: true, excludedEmails: ['jcymbalista@symphonyinfra.com', 'cdolgon@symphonyinfra.com'] },
];

// ─── Internal Graph helpers ───────────────────────────────────────────────────

const CONTENT_LIST_NAME = 'IntranetContent';

let _siteId: string | null = null;
let _listId: string | null = null;

async function getToken(msalInstance: any): Promise<string | null> {
  try {
    const accounts = msalInstance.getAllAccounts();
    if (!accounts.length) return null;
    const result = await msalInstance.acquireTokenSilent({
      scopes: ['Sites.ReadWrite.All'],
      account: accounts[0],
    });
    return result.accessToken;
  } catch {
    return null;
  }
}

async function getSiteId(token: string): Promise<string> {
  if (_siteId) return _siteId;
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_HOST}:${SHAREPOINT_SITE_PATH}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`getSiteId failed: ${res.status}`);
  const data = await res.json();
  _siteId = data.id as string;
  return _siteId;
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
          { name: 'ContentJson', text: { allowMultipleLines: true, linesForEditing: 30 } },
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

// ─── Image upload ─────────────────────────────────────────────────────────────

/**
 * Upload an image file to the IntranetImages folder in the site's default
 * Documents drive.  Returns the permanent SharePoint webUrl on success, or
 * null on failure.
 *
 * The webUrl is accessible to any user who is authenticated with the tenant
 * (via SharePoint SSO, which is established when users sign in through MSAL).
 * Files land at:
 *   Documents/IntranetImages/<timestamp>-<originalFilename>
 */
export async function uploadImage(msalInstance: any, file: File): Promise<string | null> {
  try {
    const token = await getToken(msalInstance);
    if (!token) throw new Error('Could not acquire token for image upload');

    const siteId = await getSiteId(token);

    // Unique filename to avoid collisions
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}-${safeName}`;

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/IntranetImages/${filename}:/content`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      }
    );

    if (!res.ok) {
      console.error(`[contentService] uploadImage failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const item = await res.json();
    // webUrl is permanent; @microsoft.graph.downloadUrl expires in ~1 hour
    return (item.webUrl as string) ?? null;
  } catch (err) {
    console.error('[contentService] uploadImage error:', err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read a content block.  Returns null if SharePoint is unreachable or the item
 * has not been saved yet (callers should fall back to their DEFAULT_* constant).
 */
export async function getContent<T>(msalInstance: any, key: string): Promise<T | null> {
  try {
    const token = await getToken(msalInstance);
    if (!token) return null;

    const siteId = await getSiteId(token);
    const listId = await getOrCreateList(siteId, token);

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$filter=fields/Title eq '${key}'&$expand=fields&$select=id,fields`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.value?.length) return null;

    const json = data.value[0].fields?.ContentJson;
    return json ? (JSON.parse(json) as T) : null;
  } catch (err) {
    console.error(`[contentService] getContent("${key}") failed:`, err);
    return null;
  }
}

/**
 * Write a content block back to SharePoint.  Returns true on success.
 */
export async function setContent<T>(msalInstance: any, key: string, data: T): Promise<boolean> {
  try {
    const token = await getToken(msalInstance);
    if (!token) throw new Error('Could not acquire SharePoint token. Ensure Sites.ReadWrite.All has been admin-consented.');

    const siteId = await getSiteId(token);
    const listId = await getOrCreateList(siteId, token);
    const contentJson = JSON.stringify(data);

    // Check if item already exists
    const findRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$filter=fields/Title eq '${key}'&$expand=fields&$select=id`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const findData = await findRes.json();

    if (findData.value?.length > 0) {
      const itemId = findData.value[0].id;
      const patchRes = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}/fields`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ContentJson: contentJson }),
        }
      );
      return patchRes.ok;
    } else {
      const createRes = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: { Title: key, ContentJson: contentJson } }),
        }
      );
      return createRes.ok;
    }
  } catch (err) {
    console.error(`[contentService] setContent("${key}") failed:`, err);
    return false;
  }
}
