/**
 * Runs a CloudWatch Logs Insights query over this Lambda's own log group and waits for it.
 * Used by the ICEMAN usage panel and site analytics. Needs logs:StartQuery and
 * logs:GetQueryResults on the log group (scripts/iceman-usage-policy.json).
 *
 * @aws-sdk/* ships with the Lambda Node.js runtime, so the deploy bundle leaves it external.
 */
import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  StartQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs';

/** Insights usually answers in 1–3 s; stay well inside the Function URL timeout. */
const QUERY_TIMEOUT_MS = 20_000;

export type InsightsRow = Record<string, string>;

function logGroupName(): string {
  const fn = process.env.AWS_LAMBDA_FUNCTION_NAME || 'sw-intranet-api';
  return `/aws/lambda/${fn}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Rows as { field: value } over the last `days` days. */
export async function runInsightsQuery(queryString: string, days: number): Promise<InsightsRow[]> {
  const client = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'us-east-2' });
  const endTime = Math.floor(Date.now() / 1000);
  const { queryId } = await client.send(
    new StartQueryCommand({
      logGroupName: logGroupName(),
      startTime: endTime - days * 24 * 60 * 60,
      endTime,
      queryString,
    })
  );
  if (!queryId) throw new Error('Logs Insights did not return a query id');

  const deadline = Date.now() + QUERY_TIMEOUT_MS;
  for (;;) {
    const res = await client.send(new GetQueryResultsCommand({ queryId }));
    if (res.status === 'Complete') {
      return (res.results || []).map((row) =>
        Object.fromEntries(row.map((c) => [c.field || '', c.value ?? '']))
      );
    }
    if (res.status === 'Failed' || res.status === 'Cancelled' || res.status === 'Timeout') {
      throw new Error(`Logs Insights query ${res.status}`);
    }
    if (Date.now() > deadline) throw new Error('Logs Insights query timed out');
    await sleep(700);
  }
}
