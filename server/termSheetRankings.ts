/**
 * Monthly Term Sheet Leaderboard: per-manager counts for the current month, from Power BI
 * (default; the MTD Proprietary report page's measure) or Salesforce.
 *
 * There is no roster here. The frontend decides who appears (Entra users titled
 * "Acquisitions Manager", plus anyone with counts) and who may view the leaderboard.
 *
 * The month label and cache key use TERM_SHEET_RANKINGS_TIMEZONE; the counts' month
 * boundary is whatever the source uses (the Power BI measure / Salesforce THIS_MONTH),
 * so the two can differ for a few hours around midnight on the 1st.
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

export type TermSheetRankingsResponse = {
  monthLabel: string;
  source: TermSheetRankingsSource;
  /** ISO time the data was fetched from the source (cache hits keep the original time). */
  fetchedAt: string;
  /** Managers with at least one term sheet this month, count desc then name. */
  managers: Array<{ name: string; count: number }>;
  /** Term sheets with no manager set on the opportunity (not shown on the leaderboard). */
  unassignedCount: number;
};

const DEFAULT_TIMEZONE = 'America/New_York';
const CACHE_TTL_MS = 5 * 60 * 1000;

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

/**
 * Clean source rows: drop zero / invalid counts, truncate fractions, merge rows whose
 * names differ only by case or spacing (keeping the first spelling), and sort.
 */
export function normalizeManagerCounts(
  rows: ManagerTermSheetCount[]
): Pick<TermSheetRankingsResponse, 'managers' | 'unassignedCount'> {
  const byName = new Map<string, { name: string; count: number }>();
  let unassignedCount = 0;

  for (const row of rows) {
    const rawCount = Number(row.count);
    const count = Number.isFinite(rawCount) ? Math.max(0, Math.trunc(rawCount)) : 0;
    if (!count) continue;

    const name = String(row.name ?? '').trim().replace(/\s+/g, ' ');
    if (!name) {
      unassignedCount += count;
      continue;
    }
    const key = normalizeName(name);
    const prev = byName.get(key);
    byName.set(key, { name: prev?.name ?? name, count: (prev?.count ?? 0) + count });
  }

  const managers = [...byName.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );
  return { managers, unassignedCount };
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
      ...normalizeManagerCounts(rows),
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
