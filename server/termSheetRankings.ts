/**
 * Monthly Term Sheet Leaderboard: per-AM counts for the current month, from Power BI
 * (default; the MTD Proprietary report page's measure) or Salesforce, mapped onto the
 * fixed AM roster. The month label and cache key use TERM_SHEET_RANKINGS_TIMEZONE; the
 * counts' month boundary is whatever the source uses (the Power BI measure / Salesforce
 * THIS_MONTH), so the two can differ for a few hours around midnight on the 1st.
 *
 * Env:
 *   TERM_SHEET_RANKINGS_SOURCE   'powerbi' (default) | 'salesforce'
 *   TERM_SHEET_RANKINGS_TIMEZONE IANA zone for "this month" + label (default America/New_York)
 */

import { fetchTermSheetCountsFromPowerBI } from './powerbi';
import { fetchTermSheetCountsFromSalesforce } from './salesforce';

/** One row per Acquisition Advisor Manager as returned by the data source. */
export type ManagerTermSheetCount = { name: string | null; count: number | string | null };

export type TermSheetRankingsSource = 'powerbi' | 'salesforce';

/**
 * Fixed AM roster. `displayName` must equal the manager name in the data source
 * (compared case- and whitespace-insensitively).
 */
export const TERM_SHEET_RANKING_ROSTER: Array<{
  email: string;
  matchKey: string;
  displayName: string;
}> = [
  { email: 'BSeidenberg@symphonyinfra.com', matchKey: 'Seidenberg', displayName: 'Brandon Seidenberg' },
  { email: 'CPolidoro@symphonyinfra.com', matchKey: 'Polidoro', displayName: 'Chris Polidoro' },
  { email: 'DKing@symphonyinfra.com', matchKey: 'King', displayName: 'Dylan King' },
  { email: 'esanandaji@symphonyinfra.com', matchKey: 'Sanandaji', displayName: 'Ethan Sanandaji' },
  { email: 'mkossak@symphonyinfra.com', matchKey: 'Kossak', displayName: 'Michael Kossak' },
  { email: 'NBocchi@symphonyinfra.com', matchKey: 'Bocchi', displayName: 'Nick Bocchi' },
  { email: 'scasey@symphonyinfra.com', matchKey: 'Casey', displayName: 'Shawn Casey' },
  { email: 'SSchamberg@symphonyinfra.com', matchKey: 'Schamberg', displayName: 'Steve Schamberg' },
];

export type TermSheetTier = 0 | 1 | 2 | 3;

export type TermSheetRankingRow = {
  email: string;
  displayName: string;
  matchKey: string;
  count: number;
  tier: TermSheetTier;
  dealSourceLabel: string | null;
};

export type TermSheetRankingsResponse = {
  monthLabel: string;
  source: TermSheetRankingsSource;
  /** ISO time the data was fetched from the source (cache hits keep the original time). */
  fetchedAt: string;
  rankings: TermSheetRankingRow[];
  /** Managers with term sheets who are not on the roster (name mismatches, no manager set). */
  unmatchedManagers: Array<{ name: string; count: number }>;
};

const DEFAULT_TIMEZONE = 'America/New_York';
const CACHE_TTL_MS = 5 * 60 * 1000;

export function tierForCount(count: number): TermSheetTier {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** Calendar month containing `now` in `timeZone`. `month` is 1-12. */
export function currentMonth(
  now: Date = new Date(),
  timeZone: string = process.env.TERM_SHEET_RANKINGS_TIMEZONE || DEFAULT_TIMEZONE
): { year: number; month: number; label: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const label = new Intl.DateTimeFormat('en-US', { timeZone, month: 'long', year: 'numeric' }).format(now);
  return { year, month, label };
}

/** Map source rows onto the full roster (zeros included), sorted by count desc then name. */
export function buildTermSheetRankings(rows: ManagerTermSheetCount[]): Pick<
  TermSheetRankingsResponse,
  'rankings' | 'unmatchedManagers'
> {
  const rosterByName = new Map(
    TERM_SHEET_RANKING_ROSTER.map((entry) => [normalizeName(entry.displayName), entry])
  );
  const counts = new Map<string, { count: number; dealSourceLabel: string | null }>();
  const unmatchedManagers: Array<{ name: string; count: number }> = [];

  for (const row of rows) {
    const name = String(row.name ?? '').trim();
    const rawCount = Number(row.count);
    const count = Number.isFinite(rawCount) ? Math.max(0, Math.trunc(rawCount)) : 0;
    if (!count) continue;

    const matched = name ? rosterByName.get(normalizeName(name)) : undefined;
    if (!matched) {
      unmatchedManagers.push({ name: name || '(no manager)', count });
      continue;
    }
    const prev = counts.get(matched.matchKey) || { count: 0, dealSourceLabel: null };
    counts.set(matched.matchKey, {
      count: prev.count + count,
      dealSourceLabel: prev.dealSourceLabel || name,
    });
  }

  const rankings = TERM_SHEET_RANKING_ROSTER.map((entry) => {
    const stats = counts.get(entry.matchKey) || { count: 0, dealSourceLabel: null };
    return {
      email: entry.email,
      displayName: entry.displayName,
      matchKey: entry.matchKey,
      count: stats.count,
      tier: tierForCount(stats.count),
      dealSourceLabel: stats.dealSourceLabel,
    };
  }).sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));

  return { rankings, unmatchedManagers };
}

export function resolveTermSheetRankingsSource(
  raw: string | undefined = process.env.TERM_SHEET_RANKINGS_SOURCE
): TermSheetRankingsSource {
  const value = (raw || 'powerbi').trim().toLowerCase();
  if (value === 'powerbi' || value === 'salesforce') return value;
  throw new Error(`Invalid TERM_SHEET_RANKINGS_SOURCE "${raw}". Use "powerbi" or "salesforce".`);
}

let cache: { key: string; at: number; value: TermSheetRankingsResponse } | null = null;

/** Test hook. */
export function clearTermSheetRankingsCache(): void {
  cache = null;
}

/**
 * Leaderboard data, cached in memory for 5 minutes per source + month. When the source
 * fails, the last good result for the same month is served instead of an error.
 */
export async function getTermSheetRankings(now: Date = new Date()): Promise<TermSheetRankingsResponse> {
  const source = resolveTermSheetRankingsSource();
  const month = currentMonth(now);
  const key = `${source}:${month.year}-${month.month}`;

  if (cache && cache.key === key && now.getTime() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  try {
    const rows =
      source === 'powerbi'
        ? await fetchTermSheetCountsFromPowerBI()
        : await fetchTermSheetCountsFromSalesforce();
    const value: TermSheetRankingsResponse = {
      monthLabel: month.label,
      source,
      fetchedAt: now.toISOString(),
      ...buildTermSheetRankings(rows),
    };
    cache = { key, at: now.getTime(), value };
    return value;
  } catch (err) {
    if (cache && cache.key === key) {
      console.error('[term-sheet-rankings] source failed; serving cached result', err);
      return cache.value;
    }
    throw err;
  }
}
