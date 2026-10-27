import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import type { GraphUser } from '../services/directoryService';

const msalState = vi.hoisted(() => ({
  instance: { id: 'msal' },
  accounts: [{ homeAccountId: 'home-1', username: 'Viewer@SymphonyInfra.com' }] as Array<{
    homeAccountId: string;
    username: string;
  }>,
  inProgress: 'none',
}));
vi.mock('@azure/msal-react', () => ({
  useMsal: () => msalState,
}));

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('../services/intranetApi', () => ({
  intranetApiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import TermSheetRankings from './TermSheetRankings';
import { TERM_SHEET_RANKING_ROSTER } from '../data/termSheetRankingsRoster';

const CACHE_KEY = 'term-sheet-leaderboard:v2:viewer@symphonyinfra.com';
const LEGACY_KEY = 'term-sheet-leaderboard:v1';

const manager = (displayName: string, extra: Partial<GraphUser> = {}): GraphUser => ({
  id: displayName,
  displayName,
  mail: null,
  jobTitle: 'Acquisitions Manager',
  department: null,
  ...extra,
});

const MANAGERS: GraphUser[] = [
  manager('Brandon Seidenberg'),
  manager('Chris Polidoro'),
  manager('Dylan King'),
  manager('José Núñez'),
  manager('Robert Smith (AM)', { givenName: 'Bob', surname: 'Smith' }),
];

const ADVISOR: GraphUser = {
  id: 'advisor',
  displayName: 'Jane Scott',
  mail: null,
  jobTitle: 'Acquisition Advisor',
  department: null,
};

const countsResponse = (counts: unknown) => Response.json({ monthLabel: 'October 2026', counts });

/** Names rendered in a tier row (tier-3 names carry a " (n)" suffix). */
function namesIn(tier: 0 | 1 | 2 | 3): string[] {
  const row = document.querySelector(`.term-sheet-rankings-row.tier-${tier}`);
  return Array.from(row?.querySelectorAll('.term-sheet-rankings-name') ?? []).map((el) => el.textContent ?? '');
}

const countLabelIn = (tier: 0 | 1 | 2 | 3) =>
  document.querySelector(`.term-sheet-rankings-row.tier-${tier} .term-sheet-rankings-count`)?.textContent;

const waitForBoard = () => waitFor(() => expect(document.querySelector('.term-sheet-rankings-list')).not.toBeNull());

describe('<TermSheetRankings />', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    localStorage.clear();
    apiFetch.mockReset();
    msalState.accounts = [{ homeAccountId: 'home-1', username: 'Viewer@SymphonyInfra.com' }];
    msalState.inProgress = 'none';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches live counts with no-store and groups directory managers into tiers', async () => {
    apiFetch.mockResolvedValue(
      countsResponse([
        { name: 'Brandon Seidenberg', count: 4 },
        { name: 'Chris Polidoro', count: 3 },
        { name: 'Dylan King', count: 2 },
        { name: 'Jose Nunez', count: 1 },
      ])
    );
    render(<TermSheetRankings directoryUsers={[...MANAGERS, ADVISOR]} />);

    expect(screen.getByRole('status', { name: 'Loading term sheet counts' })).toBeTruthy();
    await waitForBoard();

    // One rankings request; the history request (last month / YTD) is separate.
    const rankingCalls = apiFetch.mock.calls.filter(([, u]) => String(u).endsWith('/term-sheet-rankings'));
    expect(rankingCalls).toHaveLength(1);
    expect(apiFetch.mock.calls.some(([, u]) => String(u).endsWith('/term-sheet-history'))).toBe(true);
    const [instance, url, init] = rankingCalls[0];
    expect(instance).toBe(msalState.instance);
    expect(String(url).endsWith('/api/salesforce/term-sheet-rankings')).toBe(true);
    expect(init).toEqual({ cache: 'no-store' });

    expect(namesIn(3)).toEqual(['Brandon Seidenberg (4)', 'Chris Polidoro (3)']);
    expect(namesIn(2)).toEqual(['Dylan King']);
    // Accents and punctuation are ignored when matching Salesforce names to Entra names.
    expect(namesIn(1)).toEqual(['José Núñez']);
    // Every manager is listed (zeros included); non-managers are not.
    expect(namesIn(0)).toEqual(['Robert Smith (AM)']);
    expect(screen.queryByText('Jane Scott')).toBeNull();

    expect([countLabelIn(3), countLabelIn(2), countLabelIn(1), countLabelIn(0)]).toEqual(['3+', '2', '1', '0']);
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(screen.getByText(/Updated/)).toBeTruthy();
  });

  it('matches a Salesforce name by given name + surname', async () => {
    apiFetch.mockResolvedValue(countsResponse([{ name: 'Bob Smith', count: 2 }]));
    render(<TermSheetRankings directoryUsers={MANAGERS} />);
    await waitForBoard();
    expect(namesIn(2)).toEqual(['Robert Smith (AM)']);
  });

  it('sorts members within a tier by count, then name', async () => {
    apiFetch.mockResolvedValue(
      countsResponse([
        { name: 'Dylan King', count: 3 },
        { name: 'Chris Polidoro', count: 5 },
        { name: 'Brandon Seidenberg', count: 3 },
      ])
    );
    render(<TermSheetRankings directoryUsers={MANAGERS} />);
    await waitForBoard();
    expect(namesIn(3)).toEqual(['Chris Polidoro (5)', 'Brandon Seidenberg (3)', 'Dylan King (3)']);
  });

  it('falls back to the static roster when the directory has no managers', async () => {
    apiFetch.mockResolvedValue(countsResponse([{ name: 'Nick Bocchi', count: 1 }]));
    render(<TermSheetRankings directoryUsers={null} />);
    await waitForBoard();
    expect(namesIn(1)).toEqual(['Nick Bocchi']);
    expect(namesIn(0)).toHaveLength(TERM_SHEET_RANKING_ROSTER.length - 1);
  });

  it('lists unmatched Salesforce names but hides names on onboarding hold', async () => {
    apiFetch.mockResolvedValue(
      countsResponse([
        { name: 'Someone New', count: 2 },
        { name: 'Alex Macheras', count: 1 },
      ])
    );
    render(<TermSheetRankings directoryUsers={MANAGERS} />);
    await waitForBoard();
    expect(namesIn(2)).toEqual(['Someone New']);
    expect(screen.queryByText(/Alex Macheras/)).toBeNull();
  });

  it('shows the roster at zero with a note when the fetch fails and nothing is saved', async () => {
    apiFetch.mockResolvedValue(new Response('nope', { status: 500 }));
    render(<TermSheetRankings directoryUsers={MANAGERS} />);
    await waitForBoard();
    expect(screen.getByText(/Live counts unavailable/)).toBeTruthy();
    expect(namesIn(0)).toHaveLength(MANAGERS.length);
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('treats a response without a counts array as a failure', async () => {
    apiFetch.mockResolvedValue(Response.json({ monthLabel: 'October 2026' }));
    render(<TermSheetRankings directoryUsers={MANAGERS} />);
    await waitForBoard();
    expect(screen.getByText(/Live counts unavailable/)).toBeTruthy();
  });

  it('saves live counts per account and removes the legacy shared key', async () => {
    localStorage.setItem(LEGACY_KEY, '{"stale":true}');
    apiFetch.mockResolvedValue(countsResponse([{ name: 'Dylan King', count: 1 }]));
    render(<TermSheetRankings directoryUsers={MANAGERS} />);
    await waitForBoard();
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY)!);
    expect(saved).toEqual({
      month: '2026-10',
      counts: [{ name: 'Dylan King', count: 1 }],
      savedAt: Date.now(),
    });
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('renders saved counts for this month immediately and keeps them when the refresh fails', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ month: '2026-10', counts: [{ name: 'Dylan King', count: 2 }], savedAt: Date.now() - 60_000 })
    );
    let rejectFetch!: (err: Error) => void;
    apiFetch.mockReturnValue(new Promise((_resolve, reject) => (rejectFetch = reject)));

    render(<TermSheetRankings directoryUsers={MANAGERS} />);
    expect(screen.queryByRole('status', { name: 'Loading term sheet counts' })).toBeNull();
    expect(namesIn(2)).toEqual(['Dylan King']);

    rejectFetch(new Error('offline'));
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(namesIn(2)).toEqual(['Dylan King']);
    expect(screen.queryByText(/Live counts unavailable/)).toBeNull();
  });

  it("ignores saved counts from a previous month or another account", async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ month: '2026-09', counts: [{ name: 'Dylan King', count: 2 }], savedAt: 1 })
    );
    localStorage.setItem(
      'term-sheet-leaderboard:v2:someone@else.com',
      JSON.stringify({ month: '2026-10', counts: [{ name: 'Chris Polidoro', count: 2 }], savedAt: 1 })
    );
    apiFetch.mockReturnValue(new Promise(() => {}));
    render(<TermSheetRankings directoryUsers={MANAGERS} />);
    expect(screen.getByRole('status', { name: 'Loading term sheet counts' })).toBeTruthy();
  });

  it('does not fetch until MSAL has a signed-in account and no interaction in progress', () => {
    msalState.inProgress = 'startup';
    const { unmount } = render(<TermSheetRankings directoryUsers={MANAGERS} />);
    expect(apiFetch).not.toHaveBeenCalled();
    unmount();

    msalState.inProgress = 'none';
    msalState.accounts = [];
    render(<TermSheetRankings directoryUsers={MANAGERS} />);
    expect(apiFetch).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'Loading term sheet counts' })).toBeTruthy();
  });

  it('always renders the tier legend', () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    render(<TermSheetRankings directoryUsers={MANAGERS} />);
    for (const legend of ['3+ · Godfather', '2 · Gatsby', '1 · Success Kid', '0 · Side-eye']) {
      expect(screen.getByText(legend)).toBeTruthy();
    }
  });
});
