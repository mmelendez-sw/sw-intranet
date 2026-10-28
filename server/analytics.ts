/**
 * Site analytics events (POST /api/analytics/event). Each event becomes one CloudWatch line,
 * `[analytics] <kind> by <email>: <label>`, which analyticsSummary.ts adds up with Logs Insights.
 * No storage of its own: retention follows the Lambda's log group.
 */

export const ANALYTICS_KINDS = ['page', 'report', 'quick-link', 'card-link', 'sidebar-link', 'search'] as const;
export type AnalyticsKind = (typeof ANALYTICS_KINDS)[number];

export type AnalyticsEvent = { kind: AnalyticsKind; label: string };

export const MAX_LABEL_LENGTH = 120;

const isKind = (v: unknown): v is AnalyticsKind =>
  typeof v === 'string' && (ANALYTICS_KINDS as readonly string[]).includes(v);

/** Validates a request body; null when it isn't a usable event. Labels are one line, ≤120 chars. */
export function parseAnalyticsEvent(body: unknown): AnalyticsEvent | null {
  if (!body || typeof body !== 'object') return null;
  const { kind, label } = body as { kind?: unknown; label?: unknown };
  if (!isKind(kind) || typeof label !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const clean = label.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH).trim();
  return clean ? { kind, label: clean } : null;
}

export function formatAnalyticsLine(email: string, event: AnalyticsEvent): string {
  return `[analytics] ${event.kind} by ${email.toLowerCase()}: ${event.label}`;
}
