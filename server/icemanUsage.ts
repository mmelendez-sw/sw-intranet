/**
 * ICEMAN usage from the Lambda's own CloudWatch logs (the `[iceman] run by …` lines in
 * handler.ts), via Logs Insights. Needs logs:StartQuery and logs:GetQueryResults on this
 * function's log group (scripts/iceman-usage-policy.json).
 *
 * @aws-sdk/* ships with the Lambda Node.js runtime, so the deploy bundle leaves it external.
 */
import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  StartQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs';

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
/** Insights usually answers in 1–3 s; stay well inside the Function URL timeout. */
const QUERY_TIMEOUT_MS = 20_000;
const USAGE_CACHE_MS = 10 * 60_000;
let usageCache: { at: number; value: IcemanUsage } | null = null;

const QUERY = `
fields @timestamp, @message
| filter @message like /\\[iceman\\] run by /
| parse @message "run by *: * rows in * s, * MB workbook" as email, rows, seconds, mb
| sort @timestamp desc
| limit 10000
`;

function logGroupName(): string {
  const fn = process.env.AWS_LAMBDA_FUNCTION_NAME || 'sw-intranet-api';
  return `/aws/lambda/${fn}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getIcemanUsage(): Promise<IcemanUsage> {
  if (usageCache && Date.now() - usageCache.at < USAGE_CACHE_MS) return usageCache.value;

  const client = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'us-east-2' });
  const endTime = Math.floor(Date.now() / 1000);
  const { queryId } = await client.send(
    new StartQueryCommand({
      logGroupName: logGroupName(),
      startTime: endTime - USAGE_DAYS * 24 * 60 * 60,
      endTime,
      queryString: QUERY,
    })
  );
  if (!queryId) throw new Error('Logs Insights did not return a query id');

  const deadline = Date.now() + QUERY_TIMEOUT_MS;
  let results: { field?: string; value?: string }[][] = [];
  for (;;) {
    const res = await client.send(new GetQueryResultsCommand({ queryId }));
    if (res.status === 'Complete') {
      results = res.results || [];
      break;
    }
    if (res.status === 'Failed' || res.status === 'Cancelled' || res.status === 'Timeout') {
      throw new Error(`Logs Insights query ${res.status}`);
    }
    if (Date.now() > deadline) throw new Error('Logs Insights query timed out');
    await sleep(700);
  }

  const runs: IcemanRun[] = [];
  for (const row of results) {
    const f = Object.fromEntries(row.map((c) => [c.field, c.value ?? '']));
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
