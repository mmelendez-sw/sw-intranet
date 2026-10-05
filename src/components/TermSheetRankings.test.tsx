import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import type { GraphUser } from '../services/directoryService';

const directoryState = vi.hoisted(() => ({ users: undefined as GraphUser[] | null | undefined }));
vi.mock('../hooks/useDirectoryUsers', () => ({
  useDirectoryUsers: () => directoryState.users,
}));

import TermSheetRankings, { buildTierGroups, parseLiveRankings, tierForCount } from './TermSheetRankings';

const p = (displayName: string, count: number) => ({
  email: '',
  displayName,
  matchKey: displayName,
  count,
});

const manager = (displayName: string, mail: string): GraphUser => ({
  id: mail,
  displayName,
  mail,
  jobTitle: 'Acquisitions Manager',
  department: null,
});

const MANAGERS: GraphUser[] = [
  manager('Brandon Seidenberg', 'BSeidenberg@symphonyinfra.com'),
  manager('Chris Polidoro', 'CPolidoro@symphonyinfra.com'),
  manager('Dylan King', 'DKing@symphonyinfra.com'),
  manager('Ethan Sanandaji', 'esanandaji@symphonyinfra.com'),
  manager('Michael Kossak', 'mkossak@symphonyinfra.com'),
  manager('Nick Bocchi', 'nbocchi@symphonyinfra.com'),
  manager('Shawn Casey', 'SCasey@symphonyinfra.com'),
  manager('Steve Schamberg', 'SSchamberg@symphonyinfra.com'),
];

const ADVISOR: GraphUser = {
  id: 'jscott',
  displayName: 'Jeremy Scott',
  mail: 'JScott@symphonyinfra.com',
  jobTitle: 'Acquisitions Advisor',
  department: null,
};

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
    const people = MANAGERS.map((m, i) => p(m.displayName, i % 5));
    const names = buildTierGroups(people).flatMap((g) => g.members.map((m) => m.name));
    expect(names.sort()).toEqual(people.map((x) => x.displayName).sort());
  });
});

describe('<TermSheetRankings />', () => {
  // Default: directory loaded with the 8 managers + an advisor; the live API is unreachable,
  // so the fallback counts render.
  beforeEach(() => {
    directoryState.users = [...MANAGERS, ADVISOR];
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
  const namesIn = (li: HTMLLIElement) =>
    Array.from(li.querySelectorAll('.term-sheet-rankings-name')).map((el) => el.textContent);

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

  it('shows every Entra Acquisitions Manager exactly once, and no advisors', () => {
    render(<TermSheetRankings />);
    const names = Array.from(document.querySelectorAll('.term-sheet-rankings-name')).map(
      (el) => el.textContent
    );
    expect(names.sort()).toEqual(MANAGERS.map((m) => m.displayName).sort());
  });

  it('adds a new Entra manager to the 0 row with no code change', () => {
    directoryState.users = [...MANAGERS, manager('New Hire', 'nhire@symphonyinfra.com')];
    render(<TermSheetRankings />);
    expect(namesIn(rows()[3])).toContain('New Hire');
  });

  it('renders the legend for all tiers', () => {
    render(<TermSheetRankings />);
    const legend = document.querySelector('.term-sheet-rankings-legend') as HTMLElement;
    expect(within(legend).getByText('3+ · Godfather')).toBeTruthy();
    expect(within(legend).getByText('0 · Side-eye')).toBeTruthy();
  });

  it('fallback counts: Seidenberg and Bocchi have 1, the other managers 0', () => {
    render(<TermSheetRankings />);
    const [, , tier1, tier0] = rows();
    expect(tier1.querySelector('.term-sheet-rankings-names')?.textContent).toBe(
      'Brandon Seidenberg, Nick Bocchi'
    );
    expect(namesIn(tier0)).toHaveLength(MANAGERS.length - 2);
  });

  it('shows only people with counts while the directory is loading or unavailable', () => {
    directoryState.users = undefined;
    render(<TermSheetRankings />);
    expect(namesIn(rows()[2])).toEqual(['Brandon Seidenberg', 'Nick Bocchi']);
    expect(namesIn(rows()[3])).toEqual([]);
    cleanup();

    directoryState.users = null;
    render(<TermSheetRankings />);
    expect(namesIn(rows()[3])).toEqual([]);
  });

  const livePayload = (overrides: Record<string, unknown> = {}) => ({
    monthLabel: 'November 2026',
    source: 'powerbi',
    fetchedAt: '2026-11-03T15:00:00.000Z',
    unassignedCount: 0,
    managers: [
      { name: 'Michael Kossak', count: 4 },
      { name: 'Shawn Casey', count: 2 },
    ],
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
    expect(namesIn(tier1)).toEqual([]);
    expect(namesIn(tier0)).toHaveLength(MANAGERS.length - 2);
  });

  it('puts every manager in the 0 row when the API returns no counts yet this month', async () => {
    stubLive(livePayload({ managers: [] }));
    render(<TermSheetRankings />);
    expect(await screen.findByText('November 2026')).toBeTruthy();
    expect(namesIn(rows()[3])).toHaveLength(MANAGERS.length);
  });

  it('still shows someone with counts who is not a titled manager', async () => {
    stubLive(livePayload({ managers: [{ name: 'Jeremy Scott', count: 1 }] }));
    render(<TermSheetRankings />);
    expect(await screen.findByText('November 2026')).toBeTruthy();
    expect(namesIn(rows()[2])).toEqual(['Jeremy Scott']);
  });

  it.each([
    ['HTTP 404 (route not deployed yet)', () => stubLive({ error: 'Not found' }, 404)],
    ['HTTP 500', () => stubLive({ error: 'Power BI down' }, 500)],
    ['non-JSON body', () => stubLive('<html>gateway</html>')],
    ['missing monthLabel', () => stubLive(livePayload({ monthLabel: '' }))],
    ['old response shape', () => stubLive({ monthLabel: 'November 2026', rankings: [] })],
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
  it('maps valid rows and trims names', () => {
    expect(
      parseLiveRankings({ monthLabel: 'November 2026', managers: [{ name: ' Nick Bocchi ', count: 2 }] })
    ).toEqual({ monthLabel: 'November 2026', managers: [{ name: 'Nick Bocchi', count: 2 }] });
  });

  it('accepts an empty managers list (no term sheets yet this month)', () => {
    expect(parseLiveRankings({ monthLabel: 'M', managers: [] })).toEqual({ monthLabel: 'M', managers: [] });
  });

  it.each([
    ['null', null],
    ['string', 'nope'],
    ['no monthLabel', { managers: [] }],
    ['blank monthLabel', { monthLabel: '  ', managers: [] }],
    ['managers missing', { monthLabel: 'M' }],
    ['managers not an array', { monthLabel: 'M', managers: {} }],
    ['NaN count', { monthLabel: 'M', managers: [{ name: 'A', count: NaN }] }],
    ['fractional count', { monthLabel: 'M', managers: [{ name: 'A', count: 1.5 }] }],
    ['negative count', { monthLabel: 'M', managers: [{ name: 'A', count: -1 }] }],
    ['string count', { monthLabel: 'M', managers: [{ name: 'A', count: '2' }] }],
    ['blank name', { monthLabel: 'M', managers: [{ name: ' ', count: 1 }] }],
    ['null row', { monthLabel: 'M', managers: [null] }],
  ])('rejects %s', (_label, payload) => {
    expect(parseLiveRankings(payload)).toBeNull();
  });
});
