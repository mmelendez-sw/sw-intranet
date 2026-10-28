/**
 * ICEMAN usage from the Lambda's own CloudWatch logs (the `[iceman] run by …` lines in
 * handler.ts), via Logs Insights (see logsInsights.ts).
 */
import { runInsightsQuery } from './logsInsights';

export type IcemanRun = { at: string; email: string; rows: number; seconds: number; mb: number };
export type IcemanUserUsage = { email: string; runs: number; sites: number; lastRunAt: string };
export type IcemanUsage = {
  days: number;
  totals: { runs: number; sites: number; users: number };
  users: IcemanUserUsage[];
  recent: IcemanRun[];
};

const USAGE_DAYS = 30;
const RECENT_RUNS = 15;
const USAGE_CACHE_MS = 10 * 60_000;
let usageCache: { at: number; value: IcemanUsage } | null = null;

const QUERY = `
fields @timestamp, @message
| filter @message like /\\[iceman\\] run by /
| parse @message "run by *: * rows in * s, * MB workbook" as email, rows, seconds, mb
| sort @timestamp desc
| limit 10000
`;

export async function getIcemanUsage(): Promise<IcemanUsage> {
  if (usageCache && Date.now() - usageCache.at < USAGE_CACHE_MS) return usageCache.value;

  const results = await runInsightsQuery(QUERY, USAGE_DAYS);

  const runs: IcemanRun[] = [];
  for (const f of results) {
    const email = (f.email || '').trim().toLowerCase();
    if (!email) continue;
    runs.push({
      // Insights timestamps are "YYYY-MM-DD HH:MM:SS.mmm" in UTC.
      at: new Date(`${(f['@timestamp'] || '').replace(' ', 'T')}Z`).toISOString(),
      email,
      rows: Number(f.rows) || 0,
      seconds: Number(f.seconds) || 0,
      mb: Number(f.mb) || 0,
    });
  }

  const byUser = new Map<string, IcemanUserUsage>();
  for (const run of runs) {
    const u = byUser.get(run.email) || { email: run.email, runs: 0, sites: 0, lastRunAt: run.at };
    u.runs += 1;
    u.sites += run.rows;
    if (run.at > u.lastRunAt) u.lastRunAt = run.at;
    byUser.set(run.email, u);
  }
  const users = [...byUser.values()].sort((a, b) => b.sites - a.sites || a.email.localeCompare(b.email));

  const value: IcemanUsage = {
    days: USAGE_DAYS,
    totals: { runs: runs.length, sites: runs.reduce((n, r) => n + r.rows, 0), users: users.length },
    users,
    recent: runs.slice(0, RECENT_RUNS),
  };
  usageCache = { at: Date.now(), value };
  return value;
}
