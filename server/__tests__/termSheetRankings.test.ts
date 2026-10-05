import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../powerbi', () => ({ fetchTermSheetCountsFromPowerBI: vi.fn() }));
vi.mock('../salesforce', () => ({ fetchTermSheetCountsFromSalesforce: vi.fn() }));

import { fetchTermSheetCountsFromPowerBI } from '../powerbi';
import { fetchTermSheetCountsFromSalesforce } from '../salesforce';
import {
  clearTermSheetRankingsCache,
  currentMonth,
  getTermSheetRankings,
  normalizeManagerCounts,
  resolveTermSheetRankingsSource,
} from '../termSheetRankings';

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

describe('normalizeManagerCounts', () => {
  it('returns no managers for no rows', () => {
    expect(normalizeManagerCounts([])).toEqual({ managers: [], unassignedCount: 0 });
  });

  it('sorts by count desc then name', () => {
    expect(
      normalizeManagerCounts([
        { name: 'Shawn Casey', count: 1 },
        { name: 'Nick Bocchi', count: 4 },
        { name: 'Chris Polidoro', count: 1 },
        { name: 'Brandon Seidenberg', count: 2 },
      ]).managers
    ).toEqual([
      { name: 'Nick Bocchi', count: 4 },
      { name: 'Brandon Seidenberg', count: 2 },
      { name: 'Chris Polidoro', count: 1 },
      { name: 'Shawn Casey', count: 1 },
    ]);
  });

  it('merges names that differ only by case/spacing, keeping the first spelling', () => {
    expect(
      normalizeManagerCounts([
        { name: '  Dylan   King ', count: 1 },
        { name: 'dylan king', count: 2 },
      ]).managers
    ).toEqual([{ name: 'Dylan King', count: 3 }]);
  });

  it('keeps any manager name the source returns (no roster)', () => {
    expect(normalizeManagerCounts([{ name: 'New Hire', count: 1 }]).managers).toEqual([
      { name: 'New Hire', count: 1 },
    ]);
  });

  it('totals rows with no manager as unassigned', () => {
    expect(
      normalizeManagerCounts([
        { name: null, count: 2 },
        { name: '   ', count: 1 },
        { name: 'Nick Bocchi', count: 1 },
      ])
    ).toEqual({ managers: [{ name: 'Nick Bocchi', count: 1 }], unassignedCount: 3 });
  });

  it('drops zero, negative, and non-numeric counts and truncates fractions', () => {
    expect(
      normalizeManagerCounts([
        { name: 'A Zero', count: 0 },
        { name: 'B Text', count: 'abc' },
        { name: 'C Negative', count: -2 },
        { name: 'D Null', count: null },
        { name: 'E Fraction', count: 2.9 },
        { name: 'F String', count: '3' },
        { name: null, count: 'x' },
      ])
    ).toEqual({
      managers: [
        { name: 'F String', count: 3 },
        { name: 'E Fraction', count: 2 },
      ],
      unassignedCount: 0,
    });
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
      managers: [{ name: 'Nick Bocchi', count: 2 }],
      unassignedCount: 0,
    });
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
