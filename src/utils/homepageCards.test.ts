import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CardContent, Announcement } from '../services/contentService';

const mocks = vi.hoisted(() => ({
  cache: {} as Record<string, unknown>,
  seedCards: [] as unknown[],
  defaultCards: [] as unknown[],
  defaultAnnouncements: [] as unknown[],
}));

vi.mock('../services/contentService', () => ({
  getCachedContent: vi.fn((key: string) => mocks.cache[key] ?? null),
  // Simplified parsers: accept arrays as-is, anything else -> [].
  parseHomepageCardsContent: vi.fn((raw: unknown) => (Array.isArray(raw) ? raw : [])),
  parseAnnouncementsContent: vi.fn((raw: unknown) => (Array.isArray(raw) ? raw : [])),
  get SEED_CARDS() {
    return mocks.seedCards;
  },
  get DEFAULT_CARDS() {
    return mocks.defaultCards;
  },
  get DEFAULT_ANNOUNCEMENTS() {
    return mocks.defaultAnnouncements;
  },
}));

import {
  CARDS_CONTENT_KEY,
  HERO_CONTENT_KEY,
  ANNOUNCEMENTS_CONTENT_KEY,
  HOMEPAGE_LAYOUT_CONTENT_KEY,
  CARD_POLL,
  CARD_AUTOSAVE_MS,
  CARD_POLL_MS,
  CARDS_SPINNER_MIN_MS,
  CARDS_PER_ROW_OPTIONS,
  sortCardsByOrder,
  renumberCards,
  normalizeCards,
  cardsMatch,
  getInitialCards,
  bulletsToText,
  parseBulletLines,
  sanitizeBullets,
  todayLocalDateString,
  formatAnnouncementDate,
  getInitialAnnouncements,
  isOddCardFor4Columns,
} from './homepageCards';

const card = (order: number, title = `Card ${order}`): CardContent => ({
  order,
  title,
  bullets: [],
  imageUrl: '',
});

const announcement = (id: string): Announcement => ({
  id,
  title: `A ${id}`,
  content: '',
  date: '2026-01-01',
  isActive: true,
});

beforeEach(() => {
  mocks.cache = {};
  mocks.seedCards = [];
  mocks.defaultCards = [];
  mocks.defaultAnnouncements = [];
});

describe('constants', () => {
  it('keeps the SharePoint content keys stable', () => {
    expect(CARDS_CONTENT_KEY).toBe('homepage-cards');
    expect(HERO_CONTENT_KEY).toBe('homepage-hero');
    expect(ANNOUNCEMENTS_CONTENT_KEY).toBe('announcements');
    expect(HOMEPAGE_LAYOUT_CONTENT_KEY).toBe('homepage-layout');
  });

  it('keeps polling / autosave timings', () => {
    expect(CARD_POLL).toEqual({ remoteOnly: true });
    expect(CARD_AUTOSAVE_MS).toBe(800);
    expect(CARD_POLL_MS).toBe(20_000);
    expect(CARDS_SPINNER_MIN_MS).toBe(0);
  });

  it('offers 2-5 cards per row', () => {
    expect(CARDS_PER_ROW_OPTIONS).toEqual([2, 3, 4, 5]);
  });
});

describe('sortCardsByOrder', () => {
  it('sorts ascending by order without mutating the input', () => {
    const input = [card(3), card(1), card(2)];
    const out = sortCardsByOrder(input);
    expect(out.map((c) => c.order)).toEqual([1, 2, 3]);
    expect(input.map((c) => c.order)).toEqual([3, 1, 2]);
    expect(out).not.toBe(input);
  });

  it('is stable for equal order values', () => {
    const out = sortCardsByOrder([card(1, 'a'), card(0, 'z'), card(1, 'b')]);
    expect(out.map((c) => c.title)).toEqual(['z', 'a', 'b']);
  });

  it('handles an empty list', () => {
    expect(sortCardsByOrder([])).toEqual([]);
  });
});

describe('renumberCards', () => {
  it('assigns 1-based sequential order in array order', () => {
    const out = renumberCards([card(10, 'a'), card(5, 'b'), card(99, 'c')]);
    expect(out.map((c) => [c.title, c.order])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('returns new objects and does not mutate input', () => {
    const input = [card(7)];
    const out = renumberCards(input);
    expect(out[0]).not.toBe(input[0]);
    expect(input[0].order).toBe(7);
  });
});

describe('normalizeCards', () => {
  it('sorts then renumbers', () => {
    const out = normalizeCards([card(30, 'c'), card(10, 'a'), card(20, 'b')]);
    expect(out.map((c) => [c.title, c.order])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });
});

describe('cardsMatch', () => {
  it('is true for structurally equal lists', () => {
    expect(cardsMatch([card(1)], [card(1)])).toBe(true);
    expect(cardsMatch([], [])).toBe(true);
  });

  it('is false when values differ', () => {
    expect(cardsMatch([card(1)], [card(2)])).toBe(false);
    expect(cardsMatch([card(1)], [])).toBe(false);
  });

  it('is sensitive to key order (JSON.stringify comparison)', () => {
    const a = { order: 1, title: 't', bullets: [], imageUrl: '' } as CardContent;
    const b = { title: 't', order: 1, bullets: [], imageUrl: '' } as CardContent;
    expect(cardsMatch([a], [b])).toBe(false);
  });
});

describe('getInitialCards', () => {
  it('uses normalized cached cards when present', () => {
    mocks.cache[CARDS_CONTENT_KEY] = [card(5, 'b'), card(2, 'a')];
    expect(getInitialCards().map((c) => [c.title, c.order])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('falls back to normalized SEED_CARDS when cache is empty', () => {
    mocks.seedCards = [card(9, 'seed')];
    expect(getInitialCards()).toEqual([{ ...card(9, 'seed'), order: 1 }]);
  });

  it('falls back to DEFAULT_CARDS when cache and seed are empty', () => {
    const defaults = [card(4, 'default')];
    mocks.defaultCards = defaults;
    expect(getInitialCards()).toBe(defaults);
  });
});

describe('getInitialAnnouncements', () => {
  it('uses cached announcements when present', () => {
    const cached = [announcement('1')];
    mocks.cache[ANNOUNCEMENTS_CONTENT_KEY] = cached;
    expect(getInitialAnnouncements()).toBe(cached);
  });

  it('falls back to DEFAULT_ANNOUNCEMENTS', () => {
    const defaults = [announcement('d')];
    mocks.defaultAnnouncements = defaults;
    expect(getInitialAnnouncements()).toBe(defaults);
  });
});

describe('bullet helpers', () => {
  it('bulletsToText joins with newlines', () => {
    expect(bulletsToText(['a', 'b', 'c'])).toBe('a\nb\nc');
    expect(bulletsToText([])).toBe('');
  });

  it('parseBulletLines splits on newlines and keeps blank lines', () => {
    expect(parseBulletLines('a\n\nb\n')).toEqual(['a', '', 'b', '']);
    expect(parseBulletLines('')).toEqual(['']);
  });

  it('round-trips through text', () => {
    const bullets = ['one', '', 'three'];
    expect(parseBulletLines(bulletsToText(bullets))).toEqual(bullets);
  });

  it('sanitizeBullets drops empty and whitespace-only lines without trimming the rest', () => {
    expect(sanitizeBullets(['a', '', '   ', '\t', ' b '])).toEqual(['a', ' b ']);
  });
});

describe('todayLocalDateString', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats the local date as YYYY-MM-DD with zero padding', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0));
    expect(todayLocalDateString()).toBe('2026-01-05');
  });

  it('uses the local calendar day late in the evening', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59));
    expect(todayLocalDateString()).toBe('2026-12-31');
  });

  it('uses the local calendar day just after midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 5, 0, 0, 1));
    expect(todayLocalDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayLocalDateString()).toBe('2026-10-05');
  });
});

describe('formatAnnouncementDate', () => {
  const expected = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });

  it('formats YYYY-MM-DD as a local long date', () => {
    expect(formatAnnouncementDate('2026-03-01')).toBe(expected(2026, 3, 1));
  });

  it('does not shift a day for date-only strings (local, not UTC)', () => {
    const out = formatAnnouncementDate('2026-01-01');
    expect(out).toBe(expected(2026, 1, 1));
    expect(out).toContain('2026');
    expect(out).not.toContain('2025');
  });

  it('returns non-matching input unchanged', () => {
    expect(formatAnnouncementDate('')).toBe('');
    expect(formatAnnouncementDate('not a date')).toBe('not a date');
    expect(formatAnnouncementDate('2026-1-5')).toBe('2026-1-5');
    expect(formatAnnouncementDate('2026-01-05T10:00:00Z')).toBe('2026-01-05T10:00:00Z');
  });

  it('passes out-of-range parts to Date, which rolls them over (current behavior)', () => {
    expect(formatAnnouncementDate('2026-02-30')).toBe(expected(2026, 3, 2));
  });
});

describe('isOddCardFor4Columns', () => {
  it('matches the 4-column color pattern for indices 0-12', () => {
    // Alternates, except cards 5, 9, 13 (index 4, 8, 12) repeat the previous color.
    const pattern = Array.from({ length: 13 }, (_, i) => isOddCardFor4Columns(i));
    expect(pattern).toEqual([
      true, // 0 (card 1)
      false, // 1
      true, // 2
      false, // 3 (card 4)
      false, // 4 (card 5) same as card 4
      true, // 5
      false, // 6
      true, // 7 (card 8)
      true, // 8 (card 9) same as card 8
      false, // 9
      true, // 10
      false, // 11 (card 12)
      false, // 12 (card 13) same as card 12
    ]);
  });

  it('treats negative indices like index 0', () => {
    expect(isOddCardFor4Columns(-1)).toBe(true);
  });
});
