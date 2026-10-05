import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import TermSheetRankings, { buildTierGroups, tierForCount } from './TermSheetRankings';
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
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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

  // Snapshot of the current hand-copied counts. Update/remove when switching to the live
  // Salesforce feed (SALESFORCE_TERM_SHEET_RANKINGS_URL) — the component does not fetch yet.
  it('current spoofed counts: Seidenberg and Bocchi have 1, everyone else 0', () => {
    render(<TermSheetRankings />);
    const [, , tier1, tier0] = rows();
    expect(tier1.querySelector('.term-sheet-rankings-names')?.textContent).toBe(
      'Brandon Seidenberg, Nick Bocchi'
    );
    expect(tier0.querySelectorAll('.term-sheet-rankings-name')).toHaveLength(
      TERM_SHEET_RANKING_ROSTER.length - 2
    );
  });

  it('does not call the network', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<TermSheetRankings />);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
