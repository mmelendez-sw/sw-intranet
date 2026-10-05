import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../powerbi', () => ({ fetchTermSheetCountsFromPowerBI: vi.fn() }));
vi.mock('../salesforce', () => ({ fetchTermSheetCountsFromSalesforce: vi.fn() }));

import { fetchTermSheetCountsFromPowerBI } from '../powerbi';
import { fetchTermSheetCountsFromSalesforce } from '../salesforce';
import {
  TERM_SHEET_RANKING_ROSTER,
  buildTermSheetRankings,
  clearTermSheetRankingsCache,
  currentMonth,
  getTermSheetRankings,
  resolveTermSheetRankingsSource,
  tierForCount,
} from '../termSheetRankings';
import { TERM_SHEET_RANKING_ROSTER as FRONTEND_ROSTER } from '../../src/data/termSheetRankingsRoster';

const ENV = ['TERM_SHEET_RANKINGS_SOURCE', 'TERM_SHEET_RANKINGS_TIMEZONE'] as const;
let savedEnv: Record<string, string | undefined>;

const OCT_15 = new Date('2026-10-15T12:00:00Z');

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  clearTermSheetRankingsCache();
  vi.mocked(fetchTermSheetCountsFromPowerBI).mockReset();
  vi.mocked(fetchTermSheetCountsFromSalesforce).mockReset();
});

afterEach(() => {
  for (const k of ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.restoreAllMocks();
});

describe('roster', () => {
  it('has unique emails and matchKeys, each matchKey inside the display name', () => {
    const emails = TERM_SHEET_RANKING_ROSTER.map((r) => r.email.toLowerCase());
    const keys = TERM_SHEET_RANKING_ROSTER.map((r) => r.matchKey.toLowerCase());
    expect(new Set(emails).size).toBe(emails.length);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of TERM_SHEET_RANKING_ROSTER) {
      expect(r.displayName.toLowerCase()).toContain(r.matchKey.toLowerCase());
      expect(r.email).toMatch(/@symphonyinfra\.com$/);
    }
  });

  it('matches the frontend roster (src/data/termSheetRankingsRoster.ts)', () => {
    expect(TERM_SHEET_RANKING_ROSTER).toEqual(FRONTEND_ROSTER);
  });
});

describe('tierForCount', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [9, 3],
  ])('%i → tier %i', (count, tier) => {
    expect(tierForCount(count)).toBe(tier);
  });
});

describe('currentMonth', () => {
  it('uses America/New_York by default', () => {
    // 02:00 UTC on Nov 1 is still Oct 31 in New York.
    expect(currentMonth(new Date('2026-11-01T02:00:00Z'))).toEqual({
      year: 2026,
      month: 10,
      label: 'October 2026',
    });
  });

  it('honors an explicit or env-configured timezone', () => {
    expect(currentMonth(new Date('2026-11-01T02:00:00Z'), 'UTC').month).toBe(11);
    process.env.TERM_SHEET_RANKINGS_TIMEZONE = 'UTC';
    expect(currentMonth(new Date('2026-11-01T02:00:00Z')).label).toBe('November 2026');
  });

  it('handles the December → January boundary', () => {
    expect(currentMonth(new Date('2027-01-01T03:00:00Z'))).toMatchObject({ year: 2026, month: 12 });
  });
});

describe('buildTermSheetRankings', () => {
  it('returns the full roster with zeros when there are no rows', () => {
    const { rankings, unmatchedManagers } = buildTermSheetRankings([]);
    expect(rankings).toHaveLength(TERM_SHEET_RANKING_ROSTER.length);
    expect(rankings.every((r) => r.count === 0 && r.tier === 0 && r.dealSourceLabel === null)).toBe(true);
    const names = rankings.map((r) => r.displayName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(unmatchedManagers).toEqual([]);
  });

  it('maps counts onto the roster, assigns tiers, sorts by count desc then name', () => {
    const { rankings } = buildTermSheetRankings([
      { name: 'Nick Bocchi', count: 4 },
      { name: 'Brandon Seidenberg', count: 2 },
      { name: 'Shawn Casey', count: 1 },
      { name: 'Chris Polidoro', count: 1 },
    ]);
    expect(rankings.slice(0, 4).map((r) => [r.displayName, r.count, r.tier])).toEqual([
      ['Nick Bocchi', 4, 3],
      ['Brandon Seidenberg', 2, 2],
      ['Chris Polidoro', 1, 1],
      ['Shawn Casey', 1, 1],
    ]);
    expect(rankings[0]).toEqual({
      email: 'NBocchi@symphonyinfra.com',
      displayName: 'Nick Bocchi',
      matchKey: 'Bocchi',
      count: 4,
      tier: 3,
      dealSourceLabel: 'Nick Bocchi',
    });
  });

  it('matches names case- and whitespace-insensitively', () => {
    const { rankings } = buildTermSheetRankings([{ name: '  dylan   KING ', count: 2 }]);
    const king = rankings.find((r) => r.matchKey === 'King')!;
    expect(king.count).toBe(2);
    expect(king.dealSourceLabel).toBe('dylan   KING');
  });

  it('sums duplicate rows for the same person', () => {
    const { rankings } = buildTermSheetRankings([
      { name: 'Nick Bocchi', count: 1 },
      { name: 'nick bocchi', count: 2 },
    ]);
    expect(rankings.find((r) => r.matchKey === 'Bocchi')!.count).toBe(3);
  });

  it('uses exact names, so look-alikes are reported as unmatched', () => {
    const { rankings, unmatchedManagers } = buildTermSheetRankings([
      { name: 'Jane Kingsley', count: 3 },
      { name: 'Dylan King Jr', count: 1 },
      { name: null, count: 5 },
      { name: '   ', count: 1 },
    ]);
    expect(rankings.every((r) => r.count === 0)).toBe(true);
    expect(unmatchedManagers).toEqual([
      { name: 'Jane Kingsley', count: 3 },
      { name: 'Dylan King Jr', count: 1 },
      { name: '(no manager)', count: 5 },
      { name: '(no manager)', count: 1 },
    ]);
  });

  it('treats zero, negative, and non-numeric counts as zero and truncates fractions', () => {
    const { rankings, unmatchedManagers } = buildTermSheetRankings([
      { name: 'Michael Kossak', count: 0 },
      { name: 'Steve Schamberg', count: 'abc' },
      { name: 'Shawn Casey', count: -2 },
      { name: 'Ethan Sanandaji', count: null },
      { name: 'Chris Polidoro', count: 2.9 },
      { name: 'Dylan King', count: '3' },
    ]);
    const byKey = Object.fromEntries(rankings.map((r) => [r.matchKey, r]));
    expect([byKey.Kossak.count, byKey.Schamberg.count, byKey.Casey.count, byKey.Sanandaji.count]).toEqual([
      0, 0, 0, 0,
    ]);
    expect(byKey.Polidoro).toMatchObject({ count: 2, tier: 2 });
    expect(byKey.King).toMatchObject({ count: 3, tier: 3 });
    expect(unmatchedManagers).toEqual([]);
  });
});

describe('resolveTermSheetRankingsSource', () => {
  it('defaults to powerbi', () => {
    expect(resolveTermSheetRankingsSource(undefined)).toBe('powerbi');
    expect(resolveTermSheetRankingsSource('')).toBe('powerbi');
  });

  it('accepts powerbi / salesforce case-insensitively', () => {
    expect(resolveTermSheetRankingsSource(' PowerBI ')).toBe('powerbi');
    expect(resolveTermSheetRankingsSource('Salesforce')).toBe('salesforce');
  });

  it('rejects anything else', () => {
    expect(() => resolveTermSheetRankingsSource('excel')).toThrow('Invalid TERM_SHEET_RANKINGS_SOURCE');
  });
});

describe('getTermSheetRankings', () => {
  it('uses Power BI by default with the current New York month', async () => {
    vi.mocked(fetchTermSheetCountsFromPowerBI).mockResolvedValue([{ name: 'Nick Bocchi', count: 2 }]);
    const out = await getTermSheetRankings(OCT_15);

    expect(fetchTermSheetCountsFromPowerBI).toHaveBeenCalledWith();
    expect(fetchTermSheetCountsFromSalesforce).not.toHaveBeenCalled();
    expect(out).toMatchObject({
      monthLabel: 'October 2026',
      source: 'powerbi',
      fetchedAt: OCT_15.toISOString(),
      unmatchedManagers: [],
    });
    expect(out.rankings[0]).toMatchObject({ displayName: 'Nick Bocchi', count: 2, tier: 2 });
  });

  it('uses Salesforce when TERM_SHEET_RANKINGS_SOURCE=salesforce', async () => {
    process.env.TERM_SHEET_RANKINGS_SOURCE = 'salesforce';
    vi.mocked(fetchTermSheetCountsFromSalesforce).mockResolvedValue([]);
    const out = await getTermSheetRankings(OCT_15);
    expect(out.source).toBe('salesforce');
    expect(fetchTermSheetCountsFromPowerBI).not.toHaveBeenCalled();
  });

  it('caches for 5 minutes, then refetches', async () => {
    vi.mocked(fetchTermSheetCountsFromPowerBI).mockResolvedValue([]);
    const first = await getTermSheetRankings(OCT_15);
    const cached = await getTermSheetRankings(new Date(OCT_15.getTime() + 4 * 60_000));
    expect(cached).toBe(first);
    expect(fetchTermSheetCountsFromPowerBI).toHaveBeenCalledTimes(1);

    await getTermSheetRankings(new Date(OCT_15.getTime() + 5 * 60_000));
    expect(fetchTermSheetCountsFromPowerBI).toHaveBeenCalledTimes(2);
  });

  it('does not reuse the cache across a month change or a source change', async () => {
    vi.mocked(fetchTermSheetCountsFromPowerBI).mockResolvedValue([]);
    vi.mocked(fetchTermSheetCountsFromSalesforce).mockResolvedValue([]);
    await getTermSheetRankings(new Date('2026-10-31T23:59:00-04:00'));
    const nov = await getTermSheetRankings(new Date('2026-11-01T00:01:00-04:00'));
    expect(nov.monthLabel).toBe('November 2026');
    expect(fetchTermSheetCountsFromPowerBI).toHaveBeenCalledTimes(2);

    process.env.TERM_SHEET_RANKINGS_SOURCE = 'salesforce';
    const sf = await getTermSheetRankings(new Date('2026-11-01T00:02:00-04:00'));
    expect(sf.source).toBe('salesforce');
  });

  it('serves the last good result for the same month when the source fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(fetchTermSheetCountsFromPowerBI)
      .mockResolvedValueOnce([{ name: 'Nick Bocchi', count: 1 }])
      .mockRejectedValueOnce(new Error('Power BI down'));
    const good = await getTermSheetRankings(OCT_15);
    const stale = await getTermSheetRankings(new Date(OCT_15.getTime() + 10 * 60_000));
    expect(stale).toBe(good);
  });

  it('throws when the source fails and there is nothing cached', async () => {
    vi.mocked(fetchTermSheetCountsFromPowerBI).mockRejectedValue(new Error('Power BI down'));
    await expect(getTermSheetRankings(OCT_15)).rejects.toThrow('Power BI down');
  });

  it('does not serve a previous month as a fallback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(fetchTermSheetCountsFromPowerBI)
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Power BI down'));
    await getTermSheetRankings(OCT_15);
    await expect(getTermSheetRankings(new Date('2026-11-02T12:00:00Z'))).rejects.toThrow('Power BI down');
  });
});
