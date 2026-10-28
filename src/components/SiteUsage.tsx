import React, { useEffect, useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import '../../styles/site-usage.css';
import { ANALYTICS_SUMMARY_URL } from '../authConfig';
import { intranetApiFetch } from '../services/intranetApi';
import type { AnalyticsKind } from '../services/analytics';
import {
  DEFAULT_QUICK_LINKS,
  QuickLink,
  ReportItemContent,
  parseReportsContent,
} from '../services/contentService';
import { useSharePointContent } from '../hooks/useSharePointContent';

/** GET /api/analytics/summary (mirrors AnalyticsSummary in server/analyticsSummary.ts). */
type AnalyticsItem = { label: string; opens: number; people: number };
type AnalyticsSummaryData = {
  days: number;
  totals: { events: number; people: number };
  since: string | null;
  kinds: Record<AnalyticsKind, AnalyticsItem[]>;
};

const DAY_OPTIONS = [7, 30, 90] as const;
const ROWS_COLLAPSED = 10;

const SECTIONS: { kind: AnalyticsKind; title: string; item: string }[] = [
  { kind: 'report', title: 'Reports', item: 'Report' },
  { kind: 'page', title: 'Pages', item: 'Page' },
  { kind: 'quick-link', title: 'Quick links', item: 'Link' },
  { kind: 'card-link', title: 'Home page card links', item: 'Card → link' },
  { kind: 'sidebar-link', title: 'Sidebar links', item: 'Section → link' },
  { kind: 'search', title: 'Search picks', item: 'Result' },
];

const parseQuickLinks = (raw: unknown): QuickLink[] =>
  Array.isArray(raw) ? (raw as QuickLink[]) : DEFAULT_QUICK_LINKS;

/** Titles in `all` with no opens in `items` (case-insensitive), in their original order. */
const unopened = (all: string[], items: AnalyticsItem[] | undefined): string[] => {
  const opened = new Set((items || []).map((i) => i.label.toLowerCase()));
  return [...new Set(all.map((t) => t.trim()).filter(Boolean))].filter((t) => !opened.has(t.toLowerCase()));
};

const UsageTable: React.FC<{ title: string; item: string; rows: AnalyticsItem[] }> = ({ title, item, rows }) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, ROWS_COLLAPSED);
  return (
    <section className="site-usage-card">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="site-usage-empty">Nothing yet.</p>
      ) : (
        <>
          <table className="site-usage-table">
            <thead>
              <tr>
                <th>{item}</th>
                <th>Opens</th>
                <th title="Different people">People</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{r.opens}</td>
                  <td>{r.people}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > ROWS_COLLAPSED && (
            <button type="button" className="site-usage-more" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'Show fewer' : `Show all ${rows.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
};

/** /usage — analytics viewers only (route-guarded in App.tsx, enforced by the Lambda). */
const SiteUsage: React.FC = () => {
  const { instance } = useMsal();
  const [days, setDays] = useState<number>(30);
  const [summary, setSummary] = useState<AnalyticsSummaryData | null>(null);
  const [error, setError] = useState('');

  const { data: reports } = useSharePointContent<ReportItemContent[]>('reports', {
    fallback: [],
    parse: parseReportsContent,
  });
  const { data: quickLinks } = useSharePointContent<QuickLink[]>('quick-links', {
    fallback: DEFAULT_QUICK_LINKS,
    parse: parseQuickLinks,
  });

  useEffect(() => {
    let cancelled = false;
    setError('');
    intranetApiFetch(instance, `${ANALYTICS_SUMMARY_URL}?days=${days}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`summary request failed (${res.status})`);
        return (await res.json()) as AnalyticsSummaryData;
      })
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        console.warn('[SiteUsage]', err);
        if (!cancelled) setError("Couldn't load usage. Check the [analytics] entries in CloudWatch.");
      });
    return () => {
      cancelled = true;
    };
  }, [instance, days]);

  const current = summary && summary.days === days ? summary : null;
  /** Tracking began inside the window, so "not opened" covers less time than the period says. */
  const since =
    current?.since && Date.now() - new Date(current.since).getTime() < (current.days - 1) * 86_400_000
      ? new Date(current.since).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
  const periodText = since ? `since ${since}` : `in ${days} days`;
  const unopenedReports = useMemo(
    () => (current ? unopened((reports || []).filter((r) => r.link).map((r) => r.title), current.kinds.report) : []),
    [current, reports]
  );
  const unopenedLinks = useMemo(
    () => (current ? unopened((quickLinks || []).map((l) => l.label), current.kinds['quick-link']) : []),
    [current, quickLinks]
  );

  return (
    <div className="site-usage">
      <header className="site-usage-header">
        <div>
          <h1>Site usage</h1>
          <p>What people open on the intranet. Counts only; who clicked isn't shown.</p>
        </div>
        <div className="site-usage-days" role="group" aria-label="Period">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={d === days ? 'is-active' : ''}
              aria-pressed={d === days}
              onClick={() => setDays(d)}
            >
              {d} days
            </button>
          ))}
        </div>
      </header>

      {error && <p className="site-usage-empty">{error}</p>}
      {!current && !error && <p className="site-usage-empty">Loading…</p>}
      {current && (
        <>
          <p className="site-usage-totals">
            <strong>{current.totals.events}</strong> opens and page views ·{' '}
            <strong>{current.totals.people}</strong> {current.totals.people === 1 ? 'person' : 'people'} ·{' '}
            {since ? `since tracking began on ${since}` : `last ${current.days} days`}
          </p>
          <div className="site-usage-grid">
            {SECTIONS.map((s) => (
              <UsageTable key={s.kind} title={s.title} item={s.item} rows={current.kinds[s.kind] || []} />
            ))}
            {(unopenedReports.length > 0 || unopenedLinks.length > 0) && (
              <section className="site-usage-card">
                <h2>Not opened {periodText}</h2>
                {unopenedReports.length > 0 && (
                  <>
                    <h3>Reports</h3>
                    <ul className="site-usage-unopened">
                      {unopenedReports.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </>
                )}
                {unopenedLinks.length > 0 && (
                  <>
                    <h3>Quick links</h3>
                    <ul className="site-usage-unopened">
                      {unopenedLinks.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SiteUsage;
