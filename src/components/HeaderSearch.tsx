import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import '../../styles/header-search.css';
import { isIcemanAllowlisted } from '../authConfig';
import {
  DEFAULT_QUICK_LINKS,
  QuickLink,
  ReportItemContent,
  isReportVisibleTo,
  parseReportsContent,
} from '../services/contentService';
import { useDirectoryUsers } from '../hooks/useDirectoryUsers';
import { useSharePointContent } from '../hooks/useSharePointContent';
import { useTrackEvent } from '../hooks/useTrackEvent';
import { UserInfo } from '../types/user';

type ResultKind = 'Page' | 'Person' | 'Report' | 'Link';

interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  detail?: string;
  /** In-app route, or an external URL opened in a new tab. */
  to: string;
  external?: boolean;
}

/** Results per group, so one long list (people) can't push the others off screen. */
const MAX_PER_KIND = 6;
const KIND_ORDER: ResultKind[] = ['Page', 'Report', 'Link', 'Person'];
const KIND_ICON: Record<ResultKind, string> = {
  Page: 'fa-house',
  Person: 'fa-users',
  Report: 'fa-chart-bar',
  Link: 'fa-paper-plane',
};

const parseQuickLinks = (raw: unknown): QuickLink[] =>
  Array.isArray(raw) ? (raw as QuickLink[]) : DEFAULT_QUICK_LINKS;

/** Every word of the query appears somewhere in the haystack. */
const matches = (query: string, ...fields: (string | null | undefined)[]): boolean => {
  const haystack = fields.filter(Boolean).join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Header search across pages, reports, quick links and the directory. Ctrl+K / ⌘K opens it.
 * Sources load on first open, so the header costs nothing until someone searches.
 */
const HeaderSearch: React.FC<{ userInfo: UserInfo }> = ({ userInfo }) => {
  const navigate = useNavigate();
  const track = useTrackEvent();
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const people = useDirectoryUsers(hasOpened);
  const { data: reports } = useSharePointContent<ReportItemContent[]>('reports', {
    fallback: [],
    parse: parseReportsContent,
    enabled: hasOpened,
  });
  const { data: quickLinks } = useSharePointContent<QuickLink[]>('quick-links', {
    fallback: DEFAULT_QUICK_LINKS,
    parse: parseQuickLinks,
    enabled: hasOpened,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setHasOpened(true);
    setQuery('');
    setActive(0);
    inputRef.current?.focus();
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim();
    if (!q) return [];
    const pages: SearchResult[] = [
      { id: 'p-home', kind: 'Page', title: 'Home', to: '/' },
      { id: 'p-directory', kind: 'Page', title: 'Employee Directory', detail: 'People, titles, departments', to: '/directory' },
      { id: 'p-reports', kind: 'Page', title: 'Reports', detail: 'Power BI reports', to: '/reports' },
      { id: 'p-leads', kind: 'Page', title: 'Lead Generation', detail: 'Submit a lead', to: '/lead-generation' },
      ...(isIcemanAllowlisted(userInfo.email)
        ? [{ id: 'p-iceman', kind: 'Page' as const, title: 'ICEMAN', detail: 'Nearmap imagery to Excel', to: '/iceman' }]
        : []),
    ];
    const all: SearchResult[] = [
      ...pages.filter((p) => matches(q, p.title, p.detail)),
      ...reports
        .filter((r) => r.link && isReportVisibleTo(r, { email: userInfo.email, isEliteGroup: userInfo.isEliteGroup }))
        .filter((r) => matches(q, r.title, r.description))
        .map((r) => ({ id: `r-${r.link}`, kind: 'Report' as const, title: r.title, detail: r.description, to: r.link, external: true })),
      ...quickLinks
        .filter((l) => l.url && (!l.isNetSuiteAdminOnly || userInfo.isNetSuiteAdmin))
        .filter((l) => matches(q, l.label, l.url))
        .map((l) => ({ id: `l-${l.id}`, kind: 'Link' as const, title: l.label, detail: l.url.replace(/^https?:\/\//, ''), to: l.url, external: true })),
      ...(people || [])
        .filter((u) => matches(q, u.displayName, u.jobTitle, u.department, u.mail))
        .map((u) => ({
          id: `u-${u.id}`,
          kind: 'Person' as const,
          title: u.displayName,
          detail: [u.jobTitle, u.department].filter(Boolean).join(' · '),
          to: `/directory?q=${encodeURIComponent(u.displayName)}`,
        })),
    ];
    return KIND_ORDER.flatMap((kind) => all.filter((r) => r.kind === kind).slice(0, MAX_PER_KIND));
  }, [query, reports, quickLinks, people, userInfo.email, userInfo.isEliteGroup, userInfo.isNetSuiteAdmin]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (result: SearchResult | undefined) => {
    if (!result) return;
    setOpen(false);
    track('search', `${result.kind}: ${result.title}`);
    // Opened from search still counts as using that report or link.
    if (result.kind === 'Report') track('report', result.title);
    if (result.kind === 'Link') track('quick-link', result.title);
    if (result.external) window.open(result.to, '_blank', 'noopener');
    else navigate(result.to);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const loadingPeople = hasOpened && people === undefined;

  return (
    <>
      <button
        type="button"
        className="header-search-btn"
        onClick={() => setOpen(true)}
        aria-label="Search the intranet"
        title={`Search (${isMac ? '⌘' : 'Ctrl'}+K)`}
      >
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
        <span className="header-search-label">Search</span>
        <kbd className="header-search-kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      {open &&
        ReactDOM.createPortal(
          <div className="header-search-backdrop" onMouseDown={() => setOpen(false)}>
            <div
              className="header-search-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Search the intranet"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="header-search-input-row">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="search"
                  className="header-search-input"
                  placeholder="Search people, reports, links and pages"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKeyDown}
                  role="combobox"
                  aria-expanded={results.length > 0}
                  aria-controls="header-search-results"
                  aria-activedescendant={results[active] ? `header-search-${active}` : undefined}
                  autoComplete="off"
                />
                <kbd className="header-search-kbd">Esc</kbd>
              </div>
              {query.trim() ? (
                results.length ? (
                  <ul id="header-search-results" className="header-search-results" role="listbox" ref={listRef}>
                    {results.map((r, i) => (
                      <li
                        key={r.id}
                        id={`header-search-${i}`}
                        data-index={i}
                        role="option"
                        aria-selected={i === active}
                        className={`header-search-result${i === active ? ' is-active' : ''}`}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => choose(r)}
                      >
                        <i className={`fa-solid ${KIND_ICON[r.kind]} header-search-result-icon`} aria-hidden="true" />
                        <span className="header-search-result-text">
                          <span className="header-search-result-title">{r.title}</span>
                          {r.detail && <span className="header-search-result-detail">{r.detail}</span>}
                        </span>
                        <span className="header-search-result-kind">{r.kind}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="header-search-empty">
                    {loadingPeople ? 'Loading the directory…' : `No results for "${query.trim()}".`}
                  </p>
                )
              ) : (
                <p className="header-search-empty">Type a name, report or link. ↑ ↓ to move, Enter to open.</p>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default HeaderSearch;
