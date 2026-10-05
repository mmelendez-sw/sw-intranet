import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import TermSheetRankings, { buildTierGroups, parseLiveRankings, tierForCount } from './TermSheetRankings';
import {
  TERM_SHEET_RANKING_ROSTER,
  TERM_SHEET_RANKINGS_ALLOWLIST,
} from '../data/termSheetRankingsRoster';

const p = (displayName: string, count: number) => ({
  email: '',
  displayName,
  matchKey: displayName,
  count,
});

describe('termSheetRankingsRoster', () => {
  it('has unique emails and matchKeys', () => {
    const emails = TERM_SHEET_RANKING_ROSTER.map((e) => e.email.toLowerCase());
    const keys = TERM_SHEET_RANKING_ROSTER.map((e) => e.matchKey);
    expect(new Set(emails).size).toBe(emails.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('matchKey is the surname used in displayName', () => {
    for (const entry of TERM_SHEET_RANKING_ROSTER) {
      expect(entry.displayName.endsWith(entry.matchKey)).toBe(true);
      expect(entry.email).toMatch(/@symphonyinfra\.com$/i);
    }
  });

  it('allowlist is lowercased and includes every AM plus extra viewers', () => {
    for (const email of TERM_SHEET_RANKINGS_ALLOWLIST) {
      expect(email).toBe(email.toLowerCase());
    }
    for (const entry of TERM_SHEET_RANKING_ROSTER) {
      expect(TERM_SHEET_RANKINGS_ALLOWLIST.has(entry.email.toLowerCase())).toBe(true);
    }
    expect(TERM_SHEET_RANKINGS_ALLOWLIST.has('mmelendez@symphonyinfra.com')).toBe(true);
    expect(TERM_SHEET_RANKINGS_ALLOWLIST.size).toBe(TERM_SHEET_RANKING_ROSTER.length + 5);
  });
});

describe('tierForCount', () => {
  it('maps counts to tiers 0/1/2/3+', () => {
    expect(tierForCount(-1)).toBe(0);
    expect(tierForCount(0)).toBe(0);
    expect(tierForCount(1)).toBe(1);
    expect(tierForCount(2)).toBe(2);
    expect(tierForCount(3)).toBe(3);
    expect(tierForCount(17)).toBe(3);
  });
});

describe('buildTierGroups', () => {
  it('always returns all four tiers in 3,2,1,0 order, even when empty', () => {
    const groups = buildTierGroups([]);
    expect(groups.map((g) => g.tier)).toEqual([3, 2, 1, 0]);
    expect(groups.map((g) => g.countLabel)).toEqual(['3+', '2', '1', '0']);
    expect(groups.every((g) => g.members.length === 0)).toBe(true);
  });

  it('groups by tier, sorting by count desc then name', () => {
    const groups = buildTierGroups([
      p('Zara', 3),
      p('Amy', 5),
      p('Bob', 3),
      p('Cal', 2),
      p('Dee', 1),
      p('Eve', 0),
      p('Abe', 0),
    ]);
    const byTier = Object.fromEntries(groups.map((g) => [g.tier, g.members]));
    expect(byTier[3]).toEqual([
      { name: 'Amy', count: 5 },
      { name: 'Bob', count: 3 },
      { name: 'Zara', count: 3 },
    ]);
    expect(byTier[2]).toEqual([{ name: 'Cal', count: 2 }]);
    expect(byTier[1]).toEqual([{ name: 'Dee', count: 1 }]);
    expect(byTier[0].map((m) => m.name)).toEqual(['Abe', 'Eve']);
  });

  it('places every input person exactly once', () => {
    const people = TERM_SHEET_RANKING_ROSTER.map((e, i) => p(e.displayName, i % 5));
    const names = buildTierGroups(people).flatMap((g) => g.members.map((m) => m.name));
    expect(names.sort()).toEqual(people.map((x) => x.displayName).sort());
  });
});

describe('<TermSheetRankings />', () => {
  // Default: the live API is unreachable, so the hardcoded fallback counts render.
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const rows = () =>
    Array.from(document.querySelectorAll<HTMLLIElement>('.term-sheet-rankings-row'));

  it('renders the header with the current month', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15));
    render(<TermSheetRankings />);
    expect(screen.getByRole('region', { name: 'Monthly Term Sheet Leaderboard' })).toBeTruthy();
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(screen.getByText(/Resets monthly/)).toBeTruthy();
  });

  it('renders four tier rows in order with tier images and count badges', () => {
    render(<TermSheetRankings />);
    const list = rows();
    expect(list.map((li) => li.className.split(' ')[1])).toEqual(['tier-3', 'tier-2', 'tier-1', 'tier-0']);
    expect(list.map((li) => li.querySelector('.term-sheet-rankings-count')?.textContent)).toEqual([
      '3+',
      '2',
      '1',
      '0',
    ]);
    expect(list[2].querySelector('.term-sheet-rankings-count')?.getAttribute('title')).toBe(
      '1 term sheet this month'
    );
    expect(list[0].querySelector('.term-sheet-rankings-count')?.getAttribute('title')).toBe(
      '3+ term sheets this month'
    );
    expect(screen.getByAltText('3+ term sheets — Godfather')).toBeTruthy();
    expect(screen.getByAltText('0 term sheets')).toBeTruthy();
  });

  it('shows every roster AM exactly once', () => {
    render(<TermSheetRankings />);
    const names = Array.from(document.querySelectorAll('.term-sheet-rankings-name')).map(
      (el) => el.textContent
    );
    expect(names.sort()).toEqual(TERM_SHEET_RANKING_ROSTER.map((e) => e.displayName).sort());
  });

  it('renders the legend for all tiers', () => {
    render(<TermSheetRankings />);
    const legend = document.querySelector('.term-sheet-rankings-legend') as HTMLElement;
    expect(within(legend).getByText('3+ · Godfather')).toBeTruthy();
    expect(within(legend).getByText('0 · Side-eye')).toBeTruthy();
  });

  // Snapshot of the hand-copied fallback counts (shown while loading / when the API fails).
  it('fallback counts: Seidenberg and Bocchi have 1, everyone else 0', () => {
    render(<TermSheetRankings />);
    const [, , tier1, tier0] = rows();
    expect(tier1.querySelector('.term-sheet-rankings-names')?.textContent).toBe(
      'Brandon Seidenberg, Nick Bocchi'
    );
    expect(tier0.querySelectorAll('.term-sheet-rankings-name')).toHaveLength(
      TERM_SHEET_RANKING_ROSTER.length - 2
    );
  });

  const livePayload = (overrides: Record<string, unknown> = {}) => ({
    monthLabel: 'November 2026',
    source: 'powerbi',
    fetchedAt: '2026-11-03T15:00:00.000Z',
    unmatchedManagers: [],
    rankings: TERM_SHEET_RANKING_ROSTER.map((e) => ({
      email: e.email,
      displayName: e.displayName,
      matchKey: e.matchKey,
      count: e.matchKey === 'Kossak' ? 4 : e.matchKey === 'Casey' ? 2 : 0,
      tier: 0,
      dealSourceLabel: null,
    })),
    ...overrides,
  });

  const stubLive = (body: unknown, status = 200) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('requests /api/term-sheet-rankings without caching', () => {
    const fetchMock = stubLive(livePayload());
    render(<TermSheetRankings />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    // jsdom runs on localhost, so this resolves to the local API (npm run tv-api).
    expect(url).toBe('http://localhost:3001/api/term-sheet-rankings');
    expect(init).toMatchObject({ cache: 'no-store' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('replaces the fallback with live counts and the API month label (same markup)', async () => {
    stubLive(livePayload());
    render(<TermSheetRankings />);

    expect(await screen.findByText('November 2026')).toBeTruthy();
    const [tier3, tier2, tier1, tier0] = rows();
    expect(tier3.querySelector('.term-sheet-rankings-names')?.textContent).toBe('Michael Kossak (4)');
    expect(tier2.querySelector('.term-sheet-rankings-names')?.textContent).toBe('Shawn Casey');
    expect(tier1.querySelectorAll('.term-sheet-rankings-name')).toHaveLength(0);
    expect(tier0.querySelectorAll('.term-sheet-rankings-name')).toHaveLength(
      TERM_SHEET_RANKING_ROSTER.length - 2
    );
  });

  it.each([
    ['HTTP 404 (route not deployed yet)', () => stubLive({ error: 'Not found' }, 404)],
    ['HTTP 500', () => stubLive({ error: 'Power BI down' }, 500)],
    ['non-JSON body', () => stubLive('<html>gateway</html>')],
    ['missing monthLabel', () => stubLive(livePayload({ monthLabel: '' }))],
    ['empty rankings', () => stubLive(livePayload({ rankings: [] }))],
  ])('keeps the fallback counts on %s', async (_label, stub) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15));
    const fetchMock = stub();
    render(<TermSheetRankings />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(rows()[2].querySelector('.term-sheet-rankings-names')?.textContent).toBe(
      'Brandon Seidenberg, Nick Bocchi'
    );
  });

  it('aborts the request on unmount', () => {
    const fetchMock = stubLive(livePayload());
    const { unmount } = render(<TermSheetRankings />);
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
  });
});

describe('parseLiveRankings', () => {
  const row = (displayName: string, count: unknown, extra: Record<string, unknown> = {}) => ({
    email: 'x@symphonyinfra.com',
    displayName,
    matchKey: displayName.split(' ').pop(),
    count,
    ...extra,
  });

  it('maps valid rows', () => {
    expect(parseLiveRankings({ monthLabel: 'November 2026', rankings: [row('Nick Bocchi', 2)] })).toEqual({
      monthLabel: 'November 2026',
      people: [{ email: 'x@symphonyinfra.com', displayName: 'Nick Bocchi', matchKey: 'Bocchi', count: 2 }],
    });
  });

  it('defaults missing email / matchKey', () => {
    expect(
      parseLiveRankings({ monthLabel: 'M', rankings: [{ displayName: 'A B', count: 0 }] })?.people
    ).toEqual([{ email: '', displayName: 'A B', matchKey: 'A B', count: 0 }]);
  });

  it.each([
    ['null', null],
    ['string', 'nope'],
    ['no monthLabel', { rankings: [row('A', 1)] }],
    ['blank monthLabel', { monthLabel: '  ', rankings: [row('A', 1)] }],
    ['rankings not an array', { monthLabel: 'M', rankings: {} }],
    ['empty rankings', { monthLabel: 'M', rankings: [] }],
    ['NaN count', { monthLabel: 'M', rankings: [row('A', NaN)] }],
    ['fractional count', { monthLabel: 'M', rankings: [row('A', 1.5)] }],
    ['negative count', { monthLabel: 'M', rankings: [row('A', -1)] }],
    ['string count', { monthLabel: 'M', rankings: [row('A', '2')] }],
    ['blank name', { monthLabel: 'M', rankings: [row(' ', 1)] }],
    ['null row', { monthLabel: 'M', rankings: [null] }],
  ])('rejects %s', (_label, payload) => {
    expect(parseLiveRankings(payload)).toBeNull();
  });
});
