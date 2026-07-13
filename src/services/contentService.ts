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
 * Editor-email tracking: payloads are saved as:
 *   { "sections"|"reports"|"announcements"|"cards": [...], "editor@email": { "lastEditedAt": "..." } }
 * Tracking is written to JSON only — not shown in the intranet UI.
 *
 * Sidebar block order (sections vs quick links) is stored as sidebar-layout.json
 *
 * Card images are stored in:
 *   Shared Documents/General/intranet/images
 *
 * Default card fallback images live in:
 *   Shared Documents/General/intranet/Default Images
 * (all image files in the folder; cards cycle through them by display order)
 *
 * Department page content (updates, resources, FAQ) is stored as:
 *   General/intranet/departments/{slug}.json  (e.g. it.json, hr.json)
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
  DEFAULT_IMAGES_FOLDER_PATH,
  INTRANET_CONTENT_FOLDER_PATH,
  CARDS_DATA_FILENAME,
  REPORTS_DATA_FILENAME,
  ANNOUNCEMENTS_DATA_FILENAME,
  SIDEBAR_DATA_FILENAME,
  QUICK_LINKS_DATA_FILENAME,
  SITE_CONFIG_DATA_FILENAME,
  SIDEBAR_LAYOUT_DATA_FILENAME,
  HOMEPAGE_LAYOUT_DATA_FILENAME,
  DEPARTMENTS_CONTENT_FOLDER_PATH,
  TV_SHAREPOINT_DRIVE_ID,
  TV_HOMEPAGE_CARDS_ITEM_ID,
} from '../authConfig';
import { BUNDLED_DEFAULT_CARD_IMAGES } from '../data/bundledDefaultCardImages';
// import seedCards from '../data/homepage-cards.seed.json';

const HOMEPAGE_CARDS_KEY = 'homepage-cards';
const HOMEPAGE_HERO_KEY = 'homepage-hero';
const ANNOUNCEMENTS_CONTENT_KEY = 'announcements';
const REPORTS_CONTENT_KEY = 'reports';
const SIDEBAR_CONTENT_KEY = 'homepage-sidebar';
const QUICK_LINKS_CONTENT_KEY = 'quick-links';
const SITE_CONFIG_CONTENT_KEY = 'site-config';
const SIDEBAR_LAYOUT_CONTENT_KEY = 'sidebar-layout';
const HOMEPAGE_LAYOUT_CONTENT_KEY = 'homepage-layout';
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
  if (key === HOMEPAGE_LAYOUT_CONTENT_KEY) {
    return { folderPath: INTRANET_CONTENT_FOLDER_PATH, fileName: HOMEPAGE_LAYOUT_DATA_FILENAME };
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
  /** Public image URL. Empty string → Default Images folder (cycled by card display position). */
  imageUrl: string;
  /** Optional legacy field; defaults cycle by display position over the Default Images folder. */
  imageIndex?: number;
  createdBy?: string;
  editedBy?: string;
}

/** Drive item from Graph Default Images folder listing. */
export interface DriveItem {
  id: string;
  name: string;
  webUrl: string;
  file?: { mimeType: string };
}

export type CardWithResolvedImage = CardContent & { resolvedImageUrl: string | null };

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

let cachedDefaultImages: DriveItem[] | null = null;
let cachedDefaultImagesPending: Promise<DriveItem[]> | null = null;

function encodeDriveRelativePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/** Build a SharePoint webUrl under Shared Documents for a drive-relative path. */
export function buildSharePointDocumentUrl(driveRelativePath: string): string {
  return `https://${SHAREPOINT_HOST}${SHAREPOINT_SITE_PATH}/Shared%20Documents/${encodeDriveRelativePath(driveRelativePath)}`;
}

/**
 * List image files in Default Images (sorted by name). Cached per session.
 * Low-level: siteId + token (matches Graph listing used by /api/images proxy).
 */
export async function fetchDefaultFallbackImages(
  siteId: string,
  token: string,
  folderPath: string = DEFAULT_IMAGES_FOLDER_PATH
): Promise<DriveItem[]> {
  if (cachedDefaultImages) return cachedDefaultImages;
  if (cachedDefaultImagesPending) return cachedDefaultImagesPending;

  cachedDefaultImagesPending = (async () => {
    const path = encodeDriveRelativePath(folderPath);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${path}:/children?$select=id,name,webUrl,file&$top=200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      throw new Error(
        `Failed to list default images folder: ${res.status} ${await res.text()}`
      );
    }

    const data = await res.json();
    const items: DriveItem[] = (data.value ?? []).map(
      (item: { id?: string; name?: string; webUrl?: string; file?: { mimeType?: string } }) => ({
        id: item.id || '',
        name: item.name || '',
        webUrl: item.webUrl || '',
        file: item.file?.mimeType ? { mimeType: item.file.mimeType } : item.file ? { mimeType: '' } : undefined,
      })
    );

    const images = items
      .filter((item) => {
        if (!item.id || !item.file) return false;
        const ext = item.name.split('.').pop()?.toLowerCase() ?? '';
        return IMAGE_EXTENSIONS.has(ext);
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    cachedDefaultImages = images;
    return images;
  })();

  try {
    return await cachedDefaultImagesPending;
  } finally {
    cachedDefaultImagesPending = null;
  }
}

/**
 * List Default Images via MSAL (homepage / signed-in TV fallback).
 * Returns DriveItem[] (id, name, webUrl) — not raw string URLs.
 */
export async function fetchDefaultFallbackImageUrls(msalInstance: any): Promise<DriveItem[]> {
  try {
    const token = await getToken(msalInstance);
    if (!token) return [];
    const siteId = await getSiteId(token, IMAGE_SHAREPOINT_SITE_PATH);
    return await fetchDefaultFallbackImages(siteId, token);
  } catch (err) {
    console.warn('[contentService] Default Images folder list error:', err);
    return [];
  }
}

/** Current folder size (0 until first successful list); bundled count when folder empty. */
export const DEFAULT_FALLBACK_IMAGE_COUNT = (): number =>
  cachedDefaultImages?.length || BUNDLED_DEFAULT_CARD_IMAGES.length;

/**
 * Empty imageUrl → cycle Default Images by display position.
 * Returns YOUR proxy URL `/api/images/{id}`, not a raw SharePoint URL.
 * Falls back to bundled SPA assets when the SharePoint folder list is empty.
 */
export function getDefaultFallbackImageUrl(
  cardPosition: number,
  images: DriveItem[]
): string | null {
  if (images.length === 0) return getBundledDefaultFallbackImageUrl(cardPosition);
  const file = images[((cardPosition % images.length) + images.length) % images.length];
  if (!file?.id) return getBundledDefaultFallbackImageUrl(cardPosition);
  return `/api/images/${encodeURIComponent(file.id)}`;
}

/** Webpack-bundled defaults — work on /tv with no login and no TV API. */
export function getBundledDefaultFallbackImageUrl(cardPosition: number): string | null {
  const images = BUNDLED_DEFAULT_CARD_IMAGES;
  if (images.length === 0) return null;
  return images[((cardPosition % images.length) + images.length) % images.length] || null;
}

/** @deprecated Prefer getDefaultFallbackImageUrl — kept for existing call sites. */
export function pickDefaultFallbackImageUrl(
  images: DriveItem[],
  cardIndex: number
): string {
  return getDefaultFallbackImageUrl(cardIndex, images) || '';
}

/**
 * Display src for UI: SharePoint webUrl when listed, else bundled static asset.
 * Use getDefaultFallbackImageUrl only when a TV image proxy is available.
 */
export function getDefaultFallbackImageDisplaySrc(
  cardPosition: number,
  images: DriveItem[]
): string | null {
  if (images.length > 0) {
    const file = images[((cardPosition % images.length) + images.length) % images.length];
    if (file?.webUrl) return file.webUrl;
  }
  return getBundledDefaultFallbackImageUrl(cardPosition);
}

/** Clear cache and re-list Default Images. */
export async function refreshDefaultFallbackImages(msalInstance: any): Promise<DriveItem[]> {
  cachedDefaultImages = null;
  cachedDefaultImagesPending = null;
  return fetchDefaultFallbackImageUrls(msalInstance);
}

/** Clear cached Default Images list without fetching. */
export function clearDefaultFallbackImageUrlCache(): void {
  cachedDefaultImages = null;
  cachedDefaultImagesPending = null;
}

/**
 * Attach resolvedImageUrl: custom imageUrl when set, else `/api/images/{id}` by position.
 */
export async function resolveCardImages(
  cards: CardContent[],
  msalInstance: any
): Promise<CardWithResolvedImage[]> {
  const defaultImages = await fetchDefaultFallbackImageUrls(msalInstance);
  return cards.map((card, index) => {
    if (card.imageUrl && card.imageUrl.trim() !== '') {
      return { ...card, resolvedImageUrl: card.imageUrl };
    }
    const fallback = getDefaultFallbackImageUrl(index, defaultImages);
    return { ...card, resolvedImageUrl: fallback };
  });
}

export function resolveCardImagesSync(
  cards: CardContent[],
  defaultImages: DriveItem[]
): CardWithResolvedImage[] {
  return cards.map((card, index) => {
    if (card.imageUrl && card.imageUrl.trim() !== '') {
      return { ...card, resolvedImageUrl: card.imageUrl };
    }
    return {
      ...card,
      resolvedImageUrl: getDefaultFallbackImageUrl(index, defaultImages),
    };
  });
}

// ─── Editor email tracking in JSON files ─────────────────────────────────────
//
// Each file is saved as:
//   { "<payloadKey>": [ ...items ], "<editor@email>": { "lastEditedAt": "..." }, ... }
// Each item may also include createdBy / editedBy fields.
//
// Files: homepage-cards.json (cards), homepage-sidebar.json (sections),
//        reports.json (reports), announcements.json (announcements)
export interface EditorActivity {
  lastEditedAt: string;
}

const isEditorActivity = (value: unknown): value is EditorActivity =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as EditorActivity).lastEditedAt === 'string';

export function extractEditorActivity(
  raw: unknown,
  payloadKey: string
): Record<string, EditorActivity> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const activity: Record<string, EditorActivity> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key === payloadKey || !isEditorActivity(value)) continue;
    activity[key.toLowerCase()] = value;
  }
  return activity;
}

export function buildEditorTrackedFile<T>(
  payloadKey: string,
  items: T[],
  editorEmail?: string,
  existingRaw?: unknown
): Record<string, T[] | EditorActivity | undefined> {
  const file: Record<string, T[] | EditorActivity | undefined> = { [payloadKey]: items };
  const editorActivity = extractEditorActivity(existingRaw, payloadKey);
  const email = editorEmail?.trim().toLowerCase();
  if (email) {
    editorActivity[email] = { lastEditedAt: new Date().toISOString() };
  }
  for (const [editor, meta] of Object.entries(editorActivity)) {
    file[editor] = meta;
  }
  return file;
}

export function stampEditorFields<
  T extends { createdBy?: string; editedBy?: string },
>(item: T, editorEmail: string | undefined, isNew: boolean): T {
  const email = editorEmail?.trim().toLowerCase();
  if (!email) return item;
  if (isNew) {
    return { ...item, createdBy: item.createdBy ?? email, editedBy: email };
  }
  return { ...item, editedBy: email };
}

// ── Homepage cards (homepage-cards.json) ──

export type HomepageCardsFile = {
  cards: CardContent[];
} & Record<string, CardContent[] | EditorActivity | undefined>;

export function buildHomepageCardsFile(
  cards: CardContent[],
  editorEmail?: string,
  existingRaw?: unknown
): HomepageCardsFile {
  return buildEditorTrackedFile('cards', cards, editorEmail, existingRaw) as HomepageCardsFile;
}

export function stampCardEditor(
  card: CardContent,
  editorEmail: string | undefined,
  isNew: boolean
): CardContent {
  return stampEditorFields(card, editorEmail, isNew);
}

// ── Sidebar sections (homepage-sidebar.json) ──

export type SidebarContentFile = {
  sections: SidebarSection[];
} & Record<string, SidebarSection[] | EditorActivity | undefined>;

export function buildSidebarContentFile(
  sections: SidebarSection[],
  editorEmail?: string,
  existingRaw?: unknown
): SidebarContentFile {
  return buildEditorTrackedFile('sections', sections, editorEmail, existingRaw) as SidebarContentFile;
}

export function stampSidebarSectionEditor(
  section: SidebarSection,
  editorEmail: string | undefined,
  isNew: boolean
): SidebarSection {
  return stampEditorFields(section, editorEmail, isNew);
}

// ── Reports (reports.json) ──

export type ReportsContentFile = {
  reports: ReportItemContent[];
} & Record<string, ReportItemContent[] | EditorActivity | undefined>;

export function buildReportsContentFile(
  reports: ReportItemContent[],
  editorEmail?: string,
  existingRaw?: unknown
): ReportsContentFile {
  return buildEditorTrackedFile('reports', reports, editorEmail, existingRaw) as ReportsContentFile;
}

export function stampReportEditor(
  report: ReportItemContent,
  editorEmail: string | undefined,
  isNew: boolean
): ReportItemContent {
  return stampEditorFields(report, editorEmail, isNew);
}

// ── Announcements (announcements.json) ──

export type AnnouncementsContentFile = {
  announcements: Announcement[];
} & Record<string, Announcement[] | EditorActivity | undefined>;

export function buildAnnouncementsContentFile(
  announcements: Announcement[],
  editorEmail?: string,
  existingRaw?: unknown
): AnnouncementsContentFile {
  return buildEditorTrackedFile('announcements', announcements, editorEmail, existingRaw) as AnnouncementsContentFile;
}

export function stampAnnouncementEditor(
  announcement: Announcement,
  editorEmail: string | undefined,
  isNew: boolean
): Announcement {
  return stampEditorFields(announcement, editorEmail, isNew);
}

/** Read cards from a bare array or a wrapped { cards: [...] } file. */
export function parseHomepageCardsContent(raw: unknown): CardContent[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as CardContent[];
  if (typeof raw === 'object' && Array.isArray((raw as { cards?: CardContent[] }).cards)) {
    return (raw as { cards: CardContent[] }).cards;
  }
  return [];
}

export type HomepageCardsPerRow = 2 | 3 | 4 | 5;

export interface HomepageLayout {
  cardsPerRow: HomepageCardsPerRow;
}

export const DEFAULT_HOMEPAGE_LAYOUT: HomepageLayout = {
  cardsPerRow: 2,
};

export function normalizeHomepageLayout(raw: unknown): HomepageLayout {
  if (!raw || typeof raw !== 'object') return DEFAULT_HOMEPAGE_LAYOUT;
  const cardsPerRow = (raw as HomepageLayout).cardsPerRow;
  if (cardsPerRow === 2 || cardsPerRow === 3 || cardsPerRow === 4 || cardsPerRow === 5) {
    return { cardsPerRow };
  }
  return DEFAULT_HOMEPAGE_LAYOUT;
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
  createdBy?: string;
  editedBy?: string;
}

export interface ReportItemContent {
  order: number;
  title: string;
  description: string;
  link: string;
  isEliteOnly: boolean;
  excludedEmails: string[];
  createdBy?: string;
  editedBy?: string;
}

export interface DepartmentSectionContent {
  title: string;
  items: string[];
}

export interface DepartmentPageContent {
  updates: DepartmentSectionContent;
  resources: DepartmentSectionContent;
  faq: DepartmentSectionContent;
}

export function buildDefaultDepartmentContent(
  departmentLabel: string,
  overrides?: {
    updates?: Partial<DepartmentSectionContent>;
    resources?: Partial<DepartmentSectionContent>;
    faq?: Partial<DepartmentSectionContent>;
  }
): DepartmentPageContent {
  const withSection = (
    defaultTitle: string,
    sectionOverrides?: Partial<DepartmentSectionContent>
  ): DepartmentSectionContent => ({
    title: sectionOverrides?.title?.trim() || defaultTitle,
    items: sectionOverrides?.items ?? [],
  });

  return {
    updates: withSection(`${departmentLabel} Updates`, overrides?.updates),
    resources: withSection(`${departmentLabel} Resources`, overrides?.resources),
    faq: withSection('FAQ', overrides?.faq),
  };
}

export const EMPTY_DEPARTMENT_CONTENT = buildDefaultDepartmentContent('Department');

/** Accept legacy SharePoint payloads that stored plain string arrays per section. */
export function normalizeDepartmentContent(
  raw: unknown,
  defaults: DepartmentPageContent
): DepartmentPageContent {
  if (!raw || typeof raw !== 'object') return defaults;

  const data = raw as Record<string, unknown>;
  const firstSection = data.updates;

  if (
    firstSection &&
    typeof firstSection === 'object' &&
    !Array.isArray(firstSection) &&
    'title' in firstSection &&
    'items' in firstSection
  ) {
    const content = raw as DepartmentPageContent;
    return {
      updates: {
        title: content.updates.title?.trim() || defaults.updates.title,
        items: Array.isArray(content.updates.items) ? content.updates.items : [],
      },
      resources: {
        title: content.resources.title?.trim() || defaults.resources.title,
        items: Array.isArray(content.resources.items) ? content.resources.items : [],
      },
      faq: {
        title: content.faq.title?.trim() || defaults.faq.title,
        items: Array.isArray(content.faq.items) ? content.faq.items : [],
      },
    };
  }

  if (Array.isArray(data.updates) || Array.isArray(data.resources) || Array.isArray(data.faq)) {
    return {
      updates: {
        title: defaults.updates.title,
        items: Array.isArray(data.updates) ? (data.updates as string[]) : [],
      },
      resources: {
        title: defaults.resources.title,
        items: Array.isArray(data.resources) ? (data.resources as string[]) : [],
      },
      faq: {
        title: defaults.faq.title,
        items: Array.isArray(data.faq) ? (data.faq as string[]) : [],
      },
    };
  }

  return defaults;
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
  createdBy?: string;
  editedBy?: string;
}

/** Read sidebar sections from a bare array or a wrapped { sections: [...] } file. */
export function parseSidebarContent(raw: unknown): SidebarSection[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as SidebarSection[];
  if (typeof raw === 'object' && Array.isArray((raw as { sections?: SidebarSection[] }).sections)) {
    return (raw as { sections: SidebarSection[] }).sections;
  }
  return [];
}

/** Read reports from a bare array or a wrapped { reports: [...] } file. */
export function parseReportsContent(raw: unknown): ReportItemContent[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ReportItemContent[];
  if (typeof raw === 'object' && Array.isArray((raw as { reports?: ReportItemContent[] }).reports)) {
    return (raw as { reports: ReportItemContent[] }).reports;
  }
  return [];
}

/** Read announcements from a bare array or a wrapped { announcements: [...] } file. */
export function parseAnnouncementsContent(raw: unknown): Announcement[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Announcement[];
  if (typeof raw === 'object' && Array.isArray((raw as { announcements?: Announcement[] }).announcements)) {
    return (raw as { announcements: Announcement[] }).announcements;
  }
  return [];
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
    // Encode each segment (e.g. "Default Images") — raw spaces break Graph /content
    const encodedPath = encodeDriveRelativePath(drivePath);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodedPath}:/content`,
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
  const cachedCards = parseHomepageCardsContent(getCachedContent<unknown>(HOMEPAGE_CARDS_KEY));
  const cards = cachedCards.length ? cachedCards : SEED_CARDS;
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

  const defaultImages = await fetchDefaultFallbackImageUrls(msalInstance);
  const urls = [
    ...defaultImages.map((item) => item.webUrl).filter(Boolean),
    ...collectHomepageImageUrls(),
  ];
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

/**
 * Direct Graph read for /tv — fetches homepage-cards.json via drive ID (+ optional item ID).
 * Matches: GET /drives/{driveId}/items/{itemId}/content
 * Falls back to drive path when TV_HOMEPAGE_CARDS_ITEM_ID is not set.
 */
export async function fetchTvHomepageCardsRaw(msalInstance: any): Promise<unknown | null> {
  if (BYPASS_AUTH) {
    return readLocalContent(HOMEPAGE_CARDS_KEY);
  }

  const token = await getToken(msalInstance);
  if (!token) return null;

  const driveId = encodeURIComponent(TV_SHAREPOINT_DRIVE_ID);
  const url = TV_HOMEPAGE_CARDS_ITEM_ID
    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${TV_HOMEPAGE_CARDS_ITEM_ID}/content`
    : `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${INTRANET_CONTENT_FOLDER_PATH}/${CARDS_DATA_FILENAME}:/content`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.warn(`[contentService] fetchTvHomepageCardsRaw failed: ${res.status} ${err}`);
    return null;
  }

  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn('[contentService] fetchTvHomepageCardsRaw: invalid JSON', err);
    return null;
  }
}

/** Fetch homepage cards from the public TV API (client-credentials backend). */
export async function fetchTvHomepageCardsFromApi(apiUrl: string): Promise<unknown | null> {
  if (!apiUrl) return null;
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn(`[contentService] fetchTvHomepageCardsFromApi failed: ${res.status} ${err}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[contentService] fetchTvHomepageCardsFromApi error:', err);
    return null;
  }
}

export interface TvHomepageCardsMeta {
  eTag: string | null;
  cTag: string | null;
  lastModifiedDateTime: string | null;
}

export function tvHomepageCardsMetaFingerprint(meta: TvHomepageCardsMeta): string {
  return `${meta.eTag || meta.cTag || ''}|${meta.lastModifiedDateTime || ''}`;
}

/** Lightweight metadata poll via TV API — no card body download. */
export async function fetchTvHomepageCardsMetaFromApi(
  cardsApiUrl: string
): Promise<TvHomepageCardsMeta | null> {
  if (!cardsApiUrl) return null;
  const metaUrl = cardsApiUrl.replace(/\/?$/, '') + '/meta';
  try {
    const res = await fetch(metaUrl);
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn(`[contentService] fetchTvHomepageCardsMetaFromApi failed: ${res.status} ${err}`);
      return null;
    }
    return (await res.json()) as TvHomepageCardsMeta;
  } catch (err) {
    console.warn('[contentService] fetchTvHomepageCardsMetaFromApi error:', err);
    return null;
  }
}

/** Lightweight Graph metadata for homepage-cards.json (authenticated). */
export async function fetchTvHomepageCardsMeta(
  msalInstance: any
): Promise<TvHomepageCardsMeta | null> {
  if (BYPASS_AUTH) return null;

  const token = await getToken(msalInstance);
  if (!token || !TV_HOMEPAGE_CARDS_ITEM_ID) return null;

  const driveId = encodeURIComponent(TV_SHAREPOINT_DRIVE_ID);
  const url =
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${TV_HOMEPAGE_CARDS_ITEM_ID}` +
    `?$select=eTag,cTag,lastModifiedDateTime`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.warn(`[contentService] fetchTvHomepageCardsMeta failed: ${res.status} ${err}`);
    return null;
  }

  const data = (await res.json()) as {
    eTag?: string;
    cTag?: string;
    lastModifiedDateTime?: string;
  };

  return {
    eTag: data.eTag ?? null,
    cTag: data.cTag ?? null,
    lastModifiedDateTime: data.lastModifiedDateTime ?? null,
  };
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

// ─── Department page content (General/intranet/departments/{slug}.json) ───────

const departmentCacheKey = (slug: string): string => `department-${slug}`;

export function getDepartmentContentFileName(slug: string): string {
  return `${slug}.json`;
}

async function fetchDepartmentContentFromRemote(
  msalInstance: any,
  slug: string
): Promise<DepartmentPageContent | null> {
  try {
    const token = await getToken(msalInstance);
    if (!token) return null;

    const siteId = await getSiteId(token, SHAREPOINT_SITE_PATH);
    const parsed = await readContentFromSharePointDrive<DepartmentPageContent>(
      siteId,
      token,
      getDepartmentContentFileName(slug),
      DEPARTMENTS_CONTENT_FOLDER_PATH
    );
    if (parsed) {
      writeLocalContent(departmentCacheKey(slug), parsed);
      return parsed;
    }
    return null;
  } catch (err) {
    console.error(`[contentService] fetchDepartmentContentFromRemote("${slug}") failed:`, err);
    return null;
  }
}

export async function getDepartmentContent(
  msalInstance: any,
  slug: string,
  options?: ContentSyncOptions
): Promise<DepartmentPageContent | null> {
  const key = departmentCacheKey(slug);
  if (BYPASS_AUTH) {
    return readLocalContent<DepartmentPageContent>(key);
  }

  const cached = readLocalContent<DepartmentPageContent>(key);
  if (!options?.remoteOnly && cached !== null) {
    void fetchDepartmentContentFromRemote(msalInstance, slug);
    return cached;
  }

  const remote = await fetchDepartmentContentFromRemote(msalInstance, slug);
  if (remote !== null) return remote;

  return options?.remoteOnly ? null : cached;
}

export async function setDepartmentContent(
  msalInstance: any,
  slug: string,
  data: DepartmentPageContent,
  options?: ContentSyncOptions
): Promise<boolean> {
  const key = departmentCacheKey(slug);
  if (BYPASS_AUTH) {
    return writeLocalContent(key, data);
  }

  try {
    const token = await getToken(msalInstance);
    if (!token) throw new Error('Could not acquire SharePoint token.');

    const siteId = await getSiteId(token, SHAREPOINT_SITE_PATH);
    const driveOk = await writeContentToSharePointDrive(
      siteId,
      token,
      getDepartmentContentFileName(slug),
      data,
      DEPARTMENTS_CONTENT_FOLDER_PATH
    );
    if (driveOk) {
      writeLocalContent(key, data);
      return true;
    }
  } catch (err) {
    console.error(`[contentService] setDepartmentContent("${slug}") failed:`, err);
  }

  if (!options?.remoteOnly) {
    const localOk = writeLocalContent(key, data);
    if (localOk) {
      console.warn(
        `[contentService] setDepartmentContent("${slug}") saved to browser storage (SharePoint write failed)`
      );
      return true;
    }
  }
  return false;
}
