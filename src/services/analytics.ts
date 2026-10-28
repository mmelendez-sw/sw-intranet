/**
 * Site analytics: one POST per page view or click (report, quick link, card or sidebar link,
 * search pick) to /api/analytics/event, which logs it for the /usage page. Fire-and-forget:
 * failures are ignored and never block the click.
 */
import { ANALYTICS_EVENT_URL, BYPASS_AUTH } from '../authConfig';
import { intranetApiFetch } from './intranetApi';

/** Mirrors ANALYTICS_KINDS in server/analytics.ts. */
export type AnalyticsKind = 'page' | 'report' | 'quick-link' | 'card-link' | 'sidebar-link' | 'search';

const MAX_LABEL_LENGTH = 120;
/** A double click, or a re-render re-firing a page view, counts once. */
const DEDUPE_MS = 2000;
let lastEvent: { key: string; at: number } | null = null;

export function trackEvent(msalInstance: any, kind: AnalyticsKind, label: string | null | undefined): void {
  if (BYPASS_AUTH) return;
  const clean = (label || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH);
  if (!clean || !msalInstance?.getAllAccounts?.().length) return;

  const key = `${kind}\n${clean}`;
  const now = Date.now();
  if (lastEvent && lastEvent.key === key && now - lastEvent.at < DEDUPE_MS) return;
  lastEvent = { key, at: now };

  intranetApiFetch(msalInstance, ANALYTICS_EVENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, label: clean }),
    // Lets the request finish when the click navigates this tab away.
    keepalive: true,
  }).catch(() => {});
}

/** Test hook: forget the last event so the dedupe window doesn't leak between tests. */
export function resetAnalyticsForTests(): void {
  lastEvent = null;
}
