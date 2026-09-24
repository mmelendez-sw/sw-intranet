/**
 * Spoofed SharePoint content for BYPASS_AUTH (no Microsoft login → no Graph access).
 *
 * getContent() falls back to these when BYPASS_AUTH is on and nothing has been saved
 * locally yet. Edits made in the UI are written to localStorage and take precedence;
 * clear `intranet-local-content:*` keys to reset to this data.
 */
import type {
  Announcement,
  BirthdaysContent,
  CardContent,
  HomepageLayout,
  QuickLink,
  ReportItemContent,
  SidebarLayout,
  SidebarSection,
  SiteAlert,
  SiteConfig,
  TickerItem,
} from '../services/contentService';
import type { GraphUser } from '../services/directoryService';
import seedCards from './homepage-cards.seed.json';

const isoDaysAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const MOCK_CARDS: CardContent[] = [
  ...(seedCards as CardContent[]),
  {
    order: 4,
    title: 'IT Corner',
    bullets: [
      'Never share your MFA codes — IT will never ask for them.',
      'Report suspicious emails with the Report Phishing button in Outlook.',
      'Restart your laptop weekly so security updates can install.',
    ],
    imageUrl: '',
  },
  {
    order: 5,
    title: 'Benefits Open Enrollment',
    bullets: [
      'Open enrollment runs November 1 – November 15.',
      'Review medical, dental, and vision elections in Trinet.',
      '<a href="https://identity.trinet.com/" target="_blank" rel="noopener noreferrer">CLICK HERE</a> to log in to Trinet.',
    ],
    imageUrl: '',
  },
  {
    order: 6,
    title: 'Culture Committee',
    bullets: [
      'Fall volunteer day is coming up — watch your inbox for sign-ups.',
      'Share team photos with the committee for the next newsletter.',
    ],
    imageUrl: '',
  },
];

const MOCK_SIDEBAR: SidebarSection[] = [
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
];

const MOCK_QUICK_LINKS: QuickLink[] = [
  { id: '1', label: 'Salesforce', url: 'https://symphonyinfra.my.salesforce.com/', order: 1 },
  { id: '2', label: 'SiteTracker', url: 'https://sitetracker-symphonyinfra.my.salesforce.com/', order: 2 },
  { id: '3', label: 'Synaptek AI Search', url: 'https://symphonysitesearch.app/', order: 3 },
  { id: '4', label: 'Trinet', url: 'https://identity.trinet.com/', order: 4 },
  { id: '5', label: 'Concur', url: 'https://www.concursolutions.com/', order: 5 },
  { id: '6', label: 'Netsuite', url: 'https://system.netsuite.com/app/center/card.nl?c=8089687', order: 6, isNetSuiteAdminOnly: true },
  { id: '7', label: 'Outlook', url: 'https://outlook.office.com/', order: 7 },
];

const MOCK_SIDEBAR_LAYOUT: SidebarLayout = {
  blocks: [
    { type: 'section', key: 'hr-updates' },
    { type: 'quick-links' },
    { type: 'section', key: 'it-updates' },
    { type: 'section', key: 'exciting-news' },
  ],
};

const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'mock-ann-1',
    title: 'Office closed Monday',
    content: 'The office will be closed for the holiday. Remote work tools remain available.',
    date: isoDaysAgo(1),
    isActive: true,
  },
  {
    id: 'mock-ann-2',
    title: 'Q3 all-hands recording posted',
    content: 'Missed the all-hands? The recording is now on SharePoint under Company Meetings.',
    date: isoDaysAgo(4),
    isActive: true,
  },
  {
    id: 'mock-ann-3',
    title: 'New parking badges',
    content: 'Pick up your updated parking badge from the front desk by end of month.',
    date: isoDaysAgo(9),
    isActive: true,
  },
  {
    id: 'mock-ann-4',
    title: 'Summer hours ended',
    content: 'Normal Friday hours resume this week.',
    date: isoDaysAgo(30),
    isActive: false,
  },
];

const today = new Date();
const thisMonth = today.getMonth() + 1;
const MOCK_BIRTHDAYS: BirthdaysContent = {
  people: [
    { id: 'bday-mock-1', name: 'Alex Rivera', month: thisMonth, day: today.getDate(), email: 'arivera.demo@example.com' },
    { id: 'bday-mock-2', name: 'Jordan Lee', month: 1, day: 15 },
    { id: 'bday-mock-3', name: 'Casey Morgan', month: thisMonth, day: 3, department: 'Operations' },
    { id: 'bday-mock-4', name: 'Sam Nguyen', month: thisMonth, day: 27, department: 'Marketing' },
    // Not in the mock directory — hidden everywhere, flagged in the editor.
    { id: 'bday-mock-5', name: 'Pat Former', month: thisMonth, day: 12 },
  ],
};

const MOCK_TICKER: TickerItem[] = [
  { id: 't1', text: '🎉 Welcome to the Symphony Towers intranet (spoofed data — BYPASS_AUTH is on)', order: 1 },
  { id: 't2', text: '📈 Term sheets are up 12% month over month', order: 2 },
  { id: 't3', text: '🗓 Benefits open enrollment starts November 1', order: 3 },
];

const MOCK_ALERT: SiteAlert = {
  message: 'Spoofed alert banner — SharePoint is not being read while BYPASS_AUTH is on.',
  isActive: true,
  type: 'info',
  linkLabel: 'Learn more',
  linkUrl: 'https://symphonyinfra.com/',
};

const MOCK_SITE_CONFIG: SiteConfig = {
  supportEmail: 'support@example.com',
  leadGenEmail: 'leads@example.com',
  companyName: 'Symphony Towers Infrastructure',
};

const MOCK_LAYOUT: HomepageLayout = { cardsPerRow: 3 };

const MOCK_REPORTS: ReportItemContent[] = [
  { order: 1, title: 'Company Progress', description: 'A comprehensive view of company performance metrics and progress indicators.', link: '', isEliteOnly: false, excludedEmails: [], includedEmails: [] },
  { order: 2, title: 'All Acquisitions Summary', description: 'All acquisitions broken down by month, quarter, and year.', link: '', isEliteOnly: false, excludedEmails: [], includedEmails: [] },
  { order: 3, title: 'Daily Opportunity Count', description: 'Current opportunities, term sheets, and closed rent.', link: '', isEliteOnly: false, excludedEmails: [], includedEmails: [] },
  { order: 4, title: 'Portfolio Pipeline', description: 'A comprehensive look at the portfolio pipeline.', link: '', isEliteOnly: false, excludedEmails: [], includedEmails: [] },
  { order: 5, title: 'Elite - Origination Pipeline', description: 'Origination pipeline for elite users.', link: '', isEliteOnly: true, excludedEmails: [], includedEmails: [] },
];

const MOCK_CONTENT: Record<string, unknown> = {
  'homepage-cards': MOCK_CARDS,
  'homepage-layout': MOCK_LAYOUT,
  'homepage-sidebar': MOCK_SIDEBAR,
  'quick-links': MOCK_QUICK_LINKS,
  'sidebar-layout': MOCK_SIDEBAR_LAYOUT,
  'site-config': MOCK_SITE_CONFIG,
  'site-alert': MOCK_ALERT,
  'ticker-items': MOCK_TICKER,
  announcements: MOCK_ANNOUNCEMENTS,
  birthdays: MOCK_BIRTHDAYS,
  reports: MOCK_REPORTS,
};

export function getMockContent<T>(key: string): T | null {
  const value = MOCK_CONTENT[key];
  return value === undefined ? null : (JSON.parse(JSON.stringify(value)) as T);
}

/** Fake directory entries (not real employees) for /directory under BYPASS_AUTH. */
export const MOCK_DIRECTORY_USERS: GraphUser[] = [
  { id: 'u1', displayName: 'Alex Rivera', jobTitle: 'Acquisition Advisor', department: 'Acquisitions', mail: 'arivera.demo@example.com' },
  { id: 'u2', displayName: 'Jordan Lee', jobTitle: 'Senior Analyst', department: 'Finance', mail: 'jlee.demo@example.com' },
  { id: 'u3', displayName: 'Casey Morgan', jobTitle: 'Director of Operations', department: 'Operations', mail: 'cmorgan.demo@example.com' },
  { id: 'u4', displayName: 'Taylor Brooks', jobTitle: 'Software Engineer', department: 'Technology', mail: 'tbrooks.demo@example.com' },
  { id: 'u5', displayName: 'Morgan Patel', jobTitle: 'HR Generalist', department: 'Human Resources', mail: 'mpatel.demo@example.com' },
  { id: 'u6', displayName: 'Riley Chen', jobTitle: 'Paralegal', department: 'Legal', mail: 'rchen.demo@example.com' },
  { id: 'u7', displayName: 'Sam Nguyen', jobTitle: 'Marketing Manager', department: 'Marketing', mail: 'snguyen.demo@example.com' },
  { id: 'u8', displayName: 'Jamie Ortiz', jobTitle: 'Underwriter', department: 'Underwriting', mail: 'jortiz.demo@example.com' },
];
