/**
 * Site analytics summary (GET /api/analytics/summary): opens and distinct people per item, from
 * the `[analytics] …` lines (analytics.ts) via Logs Insights. Counts only; no per-person rows.
 */
import { ANALYTICS_KINDS, AnalyticsKind } from './analytics';
import { runInsightsQuery } from './logsInsights';

export type AnalyticsItem = { label: string; opens: number; people: number };
export type AnalyticsSummary = {
  days: number;
  totals: { events: number; people: number };
  /** Earliest event in the window (ISO), or null when there are none: tracking may be newer than `days`. */
  since: string | null;
  kinds: Record<AnalyticsKind, AnalyticsItem[]>;
};

export const ANALYTICS_DAY_OPTIONS = [7, 30, 90] as const;
const DEFAULT_DAYS = 30;
const MAX_ITEMS_PER_KIND = 50;
const SUMMARY_CACHE_MS = 10 * 60_000;
const summaryCache = new Map<number, { at: number; value: AnalyticsSummary }>();

const BASE = `
fields @message
| filter @message like /\\[analytics\\] /
| parse @message /\\[analytics\\] (?<kind>[a-z-]+) by (?<email>[^\\s:]+): (?<label>[^\\r\\n]*)/
| filter ispresent(kind)
`;

const ITEMS_QUERY = `${BASE}
| stats count(*) as opens, count_distinct(email) as people by kind, label
| sort opens desc
| limit 10000
`;

const TOTALS_QUERY = `${BASE}
| stats count(*) as events, count_distinct(email) as people, min(@timestamp) as since
`;

/** Insights timestamps are "YYYY-MM-DD HH:MM:SS.mmm" in UTC (or epoch ms from min()). */
function insightsTimeToIso(raw: string | undefined): string | null {
  if (!raw) return null;
  const date = /^\d+$/.test(raw) ? new Date(Number(raw)) : new Date(`${raw.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** 7, 30 or 90; anything else falls back to 30. */
export function analyticsDays(raw: string | undefined): number {
  const n = Number(raw);
  return (ANALYTICS_DAY_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_DAYS;
}

export async function getAnalyticsSummary(days: number = DEFAULT_DAYS): Promise<AnalyticsSummary> {
  const cached = summaryCache.get(days);
  if (cached && Date.now() - cached.at < SUMMARY_CACHE_MS) return cached.value;

  const [items, totals] = await Promise.all([
    runInsightsQuery(ITEMS_QUERY, days),
    runInsightsQuery(TOTALS_QUERY, days),
  ]);

  const kinds = Object.fromEntries(ANALYTICS_KINDS.map((k) => [k, [] as AnalyticsItem[]])) as Record<
    AnalyticsKind,
    AnalyticsItem[]
  >;
  for (const row of items) {
    const list = kinds[row.kind as AnalyticsKind];
    if (!list || !row.label || list.length >= MAX_ITEMS_PER_KIND) continue;
    list.push({ label: row.label, opens: Number(row.opens) || 0, people: Number(row.people) || 0 });
  }

  const value: AnalyticsSummary = {
    days,
    totals: { events: Number(totals[0]?.events) || 0, people: Number(totals[0]?.people) || 0 },
    since: insightsTimeToIso(totals[0]?.since),
    kinds,
  };
  summaryCache.set(days, { at: Date.now(), value });
  return value;
}
