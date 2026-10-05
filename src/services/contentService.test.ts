import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/msalToken', () => ({
  acquireSharePointToken: vi.fn(async () => null),
  acquireTokenSilentOnly: vi.fn(async () => null),
  SHAREPOINT_SCOPES: [],
  DIRECTORY_SCOPES: [],
  GRAPH_GROUP_SCOPES: [],
}));

import {
  birthdaysOrDefault,
  buildAnnouncementsContentFile,
  buildDefaultDepartmentContent,
  buildEditorTrackedFile,
  buildHomepageCardsFile,
  buildReportsContentFile,
  buildSharePointDocumentUrl,
  buildSidebarContentFile,
  CardContent,
  DEFAULT_BIRTHDAYS,
  DEFAULT_HOMEPAGE_LAYOUT,
  DriveItem,
  extractEditorActivity,
  getBundledDefaultFallbackImageUrl,
  getCachedContent,
  getCachedSharePointImageUrl,
  getContent,
  getDefaultFallbackImageDisplaySrc,
  getDefaultFallbackImageUrl,
  getDepartmentContent,
  getDepartmentContentFileName,
  getSharePointImageBlobUrl,
  isBirthdayToday,
  isSharePointImageUrl,
  normalizeDepartmentContent,
  normalizeHomepageLayout,
  parseAnnouncementsContent,
  parseBirthdaysContent,
  parseHomepageCardsContent,
  parseReportsContent,
  parseSidebarContent,
  pickDefaultFallbackImageUrl,
  resolveCardImagesSync,
  resolveTvMediaUrl,
  setContentDetailed,
  setDepartmentContentDetailed,
  stampAnnouncementEditor,
  stampCardEditor,
  stampEditorFields,
  stampReportEditor,
  stampSidebarSectionEditor,
  tvHomepageCardsMetaFingerprint,
  fetchTvHomepageCardsFromApi,
  fetchTvHomepageCardsMetaFromApi,
  DEFAULT_FALLBACK_IMAGE_COUNT,
} from './contentService';
import { BUNDLED_DEFAULT_CARD_IMAGES } from '../data/bundledDefaultCardImages';

const msal = { getAllAccounts: () => [] };

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const card = (overrides: Partial<CardContent> = {}): CardContent => ({
  order: 1,
  title: 'T',
  bullets: [],
  imageUrl: '',
  ...overrides,
});

describe('parse*Content', () => {
  it('parseHomepageCardsContent accepts arrays or { cards }', () => {
    const cards = [card()];
    expect(parseHomepageCardsContent(cards)).toBe(cards);
    expect(parseHomepageCardsContent({ cards, 'a@b.com': { lastEditedAt: 'x' } })).toBe(cards);
    expect(parseHomepageCardsContent(null)).toEqual([]);
    expect(parseHomepageCardsContent({ cards: 'nope' })).toEqual([]);
    expect(parseHomepageCardsContent('str')).toEqual([]);
  });

  it('parseSidebarContent accepts arrays or { sections }', () => {
    const sections = [{ key: 'k', order: 1, title: 't', content: 'c' }];
    expect(parseSidebarContent(sections)).toBe(sections);
    expect(parseSidebarContent({ sections })).toBe(sections);
    expect(parseSidebarContent(undefined)).toEqual([]);
    expect(parseSidebarContent({})).toEqual([]);
  });

  it('parseAnnouncementsContent accepts arrays or { announcements }', () => {
    const a = [{ id: '1', title: 't', content: 'c', date: '2026-01-01', isActive: true }];
    expect(parseAnnouncementsContent(a)).toBe(a);
    expect(parseAnnouncementsContent({ announcements: a })).toBe(a);
    expect(parseAnnouncementsContent(0)).toEqual([]);
    expect(parseAnnouncementsContent({ other: a })).toEqual([]);
  });

  it('parseReportsContent normalizes excluded/included email arrays', () => {
    const raw = {
      reports: [
        { order: 1, title: 'A', description: '', link: '', isEliteOnly: false },
        { order: 2, title: 'B', description: '', link: '', isEliteOnly: true, excludedEmails: ['x'], includedEmails: 'bad' },
      ],
    };
    const out = parseReportsContent(raw);
    expect(out[0].excludedEmails).toEqual([]);
    expect(out[0].includedEmails).toEqual([]);
    expect(out[1].excludedEmails).toEqual(['x']);
    expect(out[1].includedEmails).toEqual([]);
    expect(parseReportsContent(raw.reports)).toHaveLength(2);
    expect(parseReportsContent(null)).toEqual([]);
    expect(parseReportsContent({ nope: 1 })).toEqual([]);
  });
});

describe('parseBirthdaysContent / birthdaysOrDefault', () => {
  it('validates and normalizes entries', () => {
    const out = parseBirthdaysContent({
      people: [
        { id: 'a', name: '  Ann  ', month: '3', day: 4, email: ' a@x.com ', department: ' HR ' },
        { name: 'No Id', month: 1, day: 1, email: '  ', department: '' },
        { name: '', month: 1, day: 1 },
        { name: 'Bad Month', month: 13, day: 1 },
        { name: 'Bad Day', month: 1, day: 32 },
        { name: 'Fraction', month: 1.5, day: 1 },
        null,
        'str',
      ],
    });
    expect(out.people).toEqual([
      { id: 'a', name: 'Ann', month: 3, day: 4, email: 'a@x.com', department: 'HR' },
      { id: 'bday-2', name: 'No Id', month: 1, day: 1 },
    ]);
  });

  it('accepts a bare array and rejects junk', () => {
    expect(parseBirthdaysContent([{ name: 'A', month: 1, day: 2 }]).people).toHaveLength(1);
    expect(parseBirthdaysContent(null)).toEqual({ people: [] });
    expect(parseBirthdaysContent({ people: 'x' })).toEqual({ people: [] });
  });

  it('falls back to the bundled seed only when nothing is stored', () => {
    expect(birthdaysOrDefault(null)).toBe(DEFAULT_BIRTHDAYS);
    expect(birthdaysOrDefault(undefined)).toBe(DEFAULT_BIRTHDAYS);
    expect(birthdaysOrDefault({ people: [] })).toEqual({ people: [] });
    expect(DEFAULT_BIRTHDAYS.people.length).toBeGreaterThan(0);
  });

  it('isBirthdayToday compares month/day in local time', () => {
    const now = new Date(2026, 9, 5);
    expect(isBirthdayToday({ id: '1', name: 'A', month: 10, day: 5 }, now)).toBe(true);
    expect(isBirthdayToday({ id: '1', name: 'A', month: 10, day: 6 }, now)).toBe(false);
    expect(isBirthdayToday({ id: '1', name: 'A', month: 9, day: 5 }, now)).toBe(false);
  });
});

describe('editor tracking', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T12:00:00.000Z'));
  });

  it('extractEditorActivity keeps only well-formed editor entries, lowercased', () => {
    const raw = {
      cards: [],
      'Bob@X.com': { lastEditedAt: '2026-01-01' },
      'bad@x.com': { lastEditedAt: 5 },
      junk: 'str',
    };
    expect(extractEditorActivity(raw, 'cards')).toEqual({ 'bob@x.com': { lastEditedAt: '2026-01-01' } });
    expect(extractEditorActivity([], 'cards')).toEqual({});
    expect(extractEditorActivity(null, 'cards')).toEqual({});
  });

  it('buildEditorTrackedFile merges prior editors and stamps the current one', () => {
    const file = buildEditorTrackedFile('sections', [1, 2], ' Me@X.com ', {
      sections: ['old'],
      'other@x.com': { lastEditedAt: 'earlier' },
      'me@x.com': { lastEditedAt: 'stale' },
    });
    expect(file).toEqual({
      sections: [1, 2],
      'other@x.com': { lastEditedAt: 'earlier' },
      'me@x.com': { lastEditedAt: '2026-10-05T12:00:00.000Z' },
    });
  });

  it('buildEditorTrackedFile without an editor just carries existing activity', () => {
    expect(buildEditorTrackedFile('x', [], undefined, undefined)).toEqual({ x: [] });
  });

  it('typed build*File helpers use the right payload key', () => {
    expect(Object.keys(buildHomepageCardsFile([], 'a@x.com'))).toEqual(['cards', 'a@x.com']);
    expect(buildSidebarContentFile([]).sections).toEqual([]);
    expect(buildReportsContentFile([]).reports).toEqual([]);
    expect(buildAnnouncementsContentFile([]).announcements).toEqual([]);
  });

  it('stampEditorFields sets createdBy only for new items and preserves an existing one', () => {
    expect(stampEditorFields({ title: 'a' } as { title: string; createdBy?: string; editedBy?: string }, ' A@X.com ', true)).toEqual({
      title: 'a',
      createdBy: 'a@x.com',
      editedBy: 'a@x.com',
    });
    expect(stampEditorFields({ createdBy: 'orig@x.com' }, 'b@x.com', true)).toEqual({
      createdBy: 'orig@x.com',
      editedBy: 'b@x.com',
    });
    expect(stampEditorFields({ createdBy: 'orig@x.com' }, 'b@x.com', false)).toEqual({
      createdBy: 'orig@x.com',
      editedBy: 'b@x.com',
    });
    const item = { editedBy: 'z' };
    expect(stampEditorFields(item, '  ', false)).toBe(item);
    expect(stampEditorFields(item, undefined, true)).toBe(item);
  });

  it('typed stamp helpers delegate to stampEditorFields', () => {
    expect(stampCardEditor(card(), 'e@x.com', false).editedBy).toBe('e@x.com');
    expect(
      stampSidebarSectionEditor({ key: 'k', order: 1, title: '', content: '' }, 'e@x.com', true).createdBy
    ).toBe('e@x.com');
    expect(
      stampReportEditor(
        { order: 1, title: '', description: '', link: '', isEliteOnly: false, excludedEmails: [], includedEmails: [] },
        'e@x.com',
        false
      ).editedBy
    ).toBe('e@x.com');
    expect(
      stampAnnouncementEditor({ id: '1', title: '', content: '', date: '', isActive: true }, 'e@x.com', true).createdBy
    ).toBe('e@x.com');
  });
});

describe('normalizeHomepageLayout', () => {
  it('accepts 2–5 cards per row', () => {
    for (const n of [2, 3, 4, 5] as const) {
      expect(normalizeHomepageLayout({ cardsPerRow: n })).toEqual({ cardsPerRow: n });
    }
  });
  it('falls back to the default otherwise', () => {
    expect(normalizeHomepageLayout({ cardsPerRow: 6 })).toBe(DEFAULT_HOMEPAGE_LAYOUT);
    expect(normalizeHomepageLayout({ cardsPerRow: '3' })).toBe(DEFAULT_HOMEPAGE_LAYOUT);
    expect(normalizeHomepageLayout(null)).toBe(DEFAULT_HOMEPAGE_LAYOUT);
    expect(DEFAULT_HOMEPAGE_LAYOUT.cardsPerRow).toBe(2);
  });
});

describe('department content', () => {
  const defaults = buildDefaultDepartmentContent('IT');

  it('buildDefaultDepartmentContent names sections after the department', () => {
    expect(defaults).toEqual({
      updates: { title: 'IT Updates', items: [] },
      resources: { title: 'IT Resources', items: [] },
      faq: { title: 'FAQ', items: [] },
    });
  });

  it('buildDefaultDepartmentContent applies overrides and ignores blank titles', () => {
    const out = buildDefaultDepartmentContent('HR', {
      updates: { title: '  ', items: ['a'] },
      faq: { title: 'Questions' },
    });
    expect(out.updates).toEqual({ title: 'HR Updates', items: ['a'] });
    expect(out.faq).toEqual({ title: 'Questions', items: [] });
  });

  it('normalizeDepartmentContent keeps the sectioned shape with title fallbacks', () => {
    const out = normalizeDepartmentContent(
      {
        updates: { title: 'News', items: ['n1'] },
        resources: { title: '', items: 'bad' },
        faq: { title: 'FAQ!', items: ['q'] },
      },
      defaults
    );
    expect(out).toEqual({
      updates: { title: 'News', items: ['n1'] },
      resources: { title: 'IT Resources', items: [] },
      faq: { title: 'FAQ!', items: ['q'] },
    });
  });

  it('normalizeDepartmentContent upgrades legacy string arrays', () => {
    expect(normalizeDepartmentContent({ updates: ['u'], faq: ['f'] }, defaults)).toEqual({
      updates: { title: 'IT Updates', items: ['u'] },
      resources: { title: 'IT Resources', items: [] },
      faq: { title: 'FAQ', items: ['f'] },
    });
  });

  it('normalizeDepartmentContent returns defaults for junk', () => {
    expect(normalizeDepartmentContent(null, defaults)).toBe(defaults);
    expect(normalizeDepartmentContent({ foo: 1 }, defaults)).toBe(defaults);
  });

  it('getDepartmentContentFileName', () => {
    expect(getDepartmentContentFileName('it')).toBe('it.json');
  });
});

describe('default fallback images', () => {
  const images: DriveItem[] = [
    { id: 'a b', name: 'a.jpg', webUrl: 'https://sp/a.jpg' },
    { id: 'c', name: 'c.jpg', webUrl: '' },
  ];

  it('getDefaultFallbackImageUrl cycles by position, handles negatives, encodes ids', () => {
    expect(getDefaultFallbackImageUrl(0, images)).toBe('/api/images/a%20b');
    expect(getDefaultFallbackImageUrl(1, images)).toBe('/api/images/c');
    expect(getDefaultFallbackImageUrl(2, images)).toBe('/api/images/a%20b');
    expect(getDefaultFallbackImageUrl(-1, images)).toBe('/api/images/c');
  });

  it('uses bundled images when the folder is empty or the item has no id', () => {
    expect(getDefaultFallbackImageUrl(0, [])).toBe(BUNDLED_DEFAULT_CARD_IMAGES[0]);
    expect(getDefaultFallbackImageUrl(1, [{ id: '', name: 'x', webUrl: '' }])).toBe(
      BUNDLED_DEFAULT_CARD_IMAGES[1]
    );
  });

  it('getBundledDefaultFallbackImageUrl cycles over the bundled list', () => {
    const n = BUNDLED_DEFAULT_CARD_IMAGES.length;
    expect(getBundledDefaultFallbackImageUrl(n)).toBe(BUNDLED_DEFAULT_CARD_IMAGES[0]);
    expect(getBundledDefaultFallbackImageUrl(-1)).toBe(BUNDLED_DEFAULT_CARD_IMAGES[n - 1]);
  });

  it('pickDefaultFallbackImageUrl swaps argument order', () => {
    expect(pickDefaultFallbackImageUrl(images, 1)).toBe('/api/images/c');
  });

  it('getDefaultFallbackImageDisplaySrc prefers webUrl, else bundled', () => {
    expect(getDefaultFallbackImageDisplaySrc(0, images)).toBe('https://sp/a.jpg');
    expect(getDefaultFallbackImageDisplaySrc(1, images)).toBe(BUNDLED_DEFAULT_CARD_IMAGES[1]);
    expect(getDefaultFallbackImageDisplaySrc(2, [])).toBe(BUNDLED_DEFAULT_CARD_IMAGES[2]);
  });

  it('DEFAULT_FALLBACK_IMAGE_COUNT uses the bundled count before any listing', () => {
    expect(DEFAULT_FALLBACK_IMAGE_COUNT()).toBe(BUNDLED_DEFAULT_CARD_IMAGES.length);
  });

  it('resolveCardImagesSync keeps custom images and fills blanks by position', () => {
    const out = resolveCardImagesSync(
      [card({ imageUrl: 'https://custom' }), card({ imageUrl: '   ' }), card()],
      images
    );
    expect(out.map((c) => c.resolvedImageUrl)).toEqual([
      'https://custom',
      '/api/images/c',
      '/api/images/a%20b',
    ]);
  });
});

describe('URL helpers', () => {
  it('buildSharePointDocumentUrl encodes each segment', () => {
    expect(buildSharePointDocumentUrl('/General/intranet/Default Images/a#1.png')).toBe(
      'https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/General/intranet/Default%20Images/a%231.png'
    );
  });

  it('isSharePointImageUrl', () => {
    expect(isSharePointImageUrl('https://x.SharePoint.com/a.png')).toBe(true);
    expect(isSharePointImageUrl('https://graph.microsoft.com/v1.0/x')).toBe(true);
    expect(isSharePointImageUrl('data:image/png;base64,sharepoint')).toBe(false);
    expect(isSharePointImageUrl('blob:sharepoint')).toBe(false);
    expect(isSharePointImageUrl('https://cdn.example.com/a.png')).toBe(false);
    expect(isSharePointImageUrl('')).toBe(false);
  });

  it('getCachedSharePointImageUrl passes non-SharePoint urls through', () => {
    expect(getCachedSharePointImageUrl('')).toBeNull();
    expect(getCachedSharePointImageUrl('/local.png')).toBe('/local.png');
    expect(getCachedSharePointImageUrl('https://x.sharepoint.com/never-fetched.png')).toBeNull();
  });

  it('resolveTvMediaUrl resolves /api paths against an absolute cards API origin', () => {
    expect(resolveTvMediaUrl('/api/images/1', 'https://tv.example.com/api/tv-cards')).toBe(
      'https://tv.example.com/api/images/1'
    );
    expect(resolveTvMediaUrl(' /api/images/1 ', '/api/tv-cards')).toBe('/api/images/1');
    expect(resolveTvMediaUrl('/api/images/1')).toBe('/api/images/1');
    expect(resolveTvMediaUrl('https://other/a.png', 'https://tv.example.com')).toBe('https://other/a.png');
    expect(resolveTvMediaUrl('/api/x', 'not a url')).toBe('/api/x');
  });

  it('tvHomepageCardsMetaFingerprint prefers eTag, then cTag', () => {
    expect(tvHomepageCardsMetaFingerprint({ eTag: 'e', cTag: 'c', lastModifiedDateTime: 't' })).toBe('e|t');
    expect(tvHomepageCardsMetaFingerprint({ eTag: null, cTag: 'c', lastModifiedDateTime: null })).toBe('c|');
    expect(tvHomepageCardsMetaFingerprint({ eTag: null, cTag: null, lastModifiedDateTime: null })).toBe('|');
  });
});

describe('TV API fetchers', () => {
  it('fetchTvHomepageCardsFromApi returns JSON, or null on empty url / failure', async () => {
    expect(await fetchTvHomepageCardsFromApi('')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ cards: [] }))));
    expect(await fetchTvHomepageCardsFromApi('https://tv/api/tv-cards')).toEqual({ cards: [] });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    expect(await fetchTvHomepageCardsFromApi('https://tv/api/tv-cards')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await fetchTvHomepageCardsFromApi('https://tv/api/tv-cards')).toBeNull();
  });

  it('fetchTvHomepageCardsMetaFromApi hits {url}/meta', async () => {
    const meta = { eTag: 'e', cTag: null, lastModifiedDateTime: 't' };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(meta)));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchTvHomepageCardsMetaFromApi('https://tv/api/tv-cards/')).toEqual(meta);
    expect(fetchMock.mock.calls[0]).toEqual(['https://tv/api/tv-cards/meta']);
    expect(await fetchTvHomepageCardsMetaFromApi('')).toBeNull();
  });
});

describe('local content cache (no SharePoint token)', () => {
  const KEY = 'intranet-local-content:';

  it('getCachedContent reads what is in localStorage', () => {
    expect(getCachedContent('site-alert')).toBeNull();
    localStorage.setItem(`${KEY}site-alert`, JSON.stringify({ message: 'hi' }));
    expect(getCachedContent('site-alert')).toEqual({ message: 'hi' });
  });

  it('getCachedContent returns null for corrupt JSON', () => {
    localStorage.setItem(`${KEY}ticker-items`, '{not json');
    expect(getCachedContent('ticker-items')).toBeNull();
  });

  it('getContent returns the cached copy immediately', async () => {
    localStorage.setItem(`${KEY}ticker-items`, JSON.stringify([{ id: '1' }]));
    expect(await getContent(msal, 'ticker-items')).toEqual([{ id: '1' }]);
  });

  it('getContent returns null when there is no cache and no token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await getContent(msal, 'homepage-cards')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('getContent with remoteOnly ignores the cache', async () => {
    localStorage.setItem(`${KEY}ticker-items`, JSON.stringify([{ id: '1' }]));
    expect(await getContent(msal, 'ticker-items', { remoteOnly: true })).toBeNull();
  });

  it('setContentDetailed falls back to browser storage when SharePoint is unavailable', async () => {
    const result = await setContentDetailed(msal, 'site-alert', { message: 'x' });
    expect(result).toEqual({ ok: true, storage: 'local' });
    expect(JSON.parse(localStorage.getItem(`${KEY}site-alert`)!)).toEqual({ message: 'x' });
  });

  it('setContentDetailed with remoteOnly does not write locally', async () => {
    const result = await setContentDetailed(msal, 'site-alert', { message: 'x' }, { remoteOnly: true });
    expect(result).toEqual({ ok: false, storage: 'none' });
    expect(localStorage.getItem(`${KEY}site-alert`)).toBeNull();
  });

  it('setContentDetailed reports none when local storage also fails', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(await setContentDetailed(msal, 'site-alert', {})).toEqual({ ok: false, storage: 'none' });
  });

  it('department content uses a department-{slug} cache key', async () => {
    const data = buildDefaultDepartmentContent('IT');
    expect(await setDepartmentContentDetailed(msal, 'it', data)).toEqual({ ok: true, storage: 'local' });
    expect(localStorage.getItem(`${KEY}department-it`)).not.toBeNull();
    expect(await getDepartmentContent(msal, 'it')).toEqual(data);
    expect(await getDepartmentContent(msal, 'it', { remoteOnly: true })).toBeNull();
    expect(await setDepartmentContentDetailed(msal, 'hr', data, { remoteOnly: true })).toEqual({
      ok: false,
      storage: 'none',
    });
  });
});

describe('getSharePointImageBlobUrl', () => {
  it('passes non-SharePoint urls through without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await getSharePointImageBlobUrl(msal, '')).toBeNull();
    expect(await getSharePointImageBlobUrl(msal, '/img.png')).toBe('/img.png');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null for SharePoint urls when no token is available', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await getSharePointImageBlobUrl(msal, 'https://x.sharepoint.com/a.png')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
