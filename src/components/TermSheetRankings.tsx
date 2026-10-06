import React, { useEffect, useMemo, useState } from 'react';
import { InteractionStatus } from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';
import { BYPASS_AUTH, SALESFORCE_TERM_SHEET_RANKINGS_URL } from '../authConfig';
import { isAcquisitionsManagerTitle, TERM_SHEET_RANKING_ROSTER } from '../data/termSheetRankingsRoster';
import { GraphUser } from '../services/directoryService';
import { intranetApiFetch } from '../services/intranetApi';
import '../../styles/term-sheet-rankings.css';
import awkwardKidImg from '../../images/term-sheet-rankings/awkward-kid.png';
import awesomeKidImg from '../../images/term-sheet-rankings/awesome-kid.png';
import gatsbyImg from '../../images/term-sheet-rankings/gatsby.png';
import godfatherImg from '../../images/term-sheet-rankings/godfather.png';

export type TermSheetTier = 0 | 1 | 2 | 3;

type LeaderboardPerson = {
  displayName: string;
  count: number;
};

/** One row of GET /api/salesforce/term-sheet-rankings → counts. */
type TermSheetCountRow = {
  name: string;
  count: number;
};

type TierGroup = {
  tier: TermSheetTier;
  countLabel: string;
  members: { name: string; count: number }[];
};

const TIER_META: Record<
  TermSheetTier,
  { image: string; imagePosition?: string; label: string; legend: string; className: string }
> = {
  0: { image: awkwardKidImg, label: '0 term sheets', legend: '0 · Side-eye', className: 'tier-0' },
  1: {
    image: awesomeKidImg,
    imagePosition: '8% center',
    label: '1 term sheet',
    legend: '1 · Success Kid',
    className: 'tier-1',
  },
  2: { image: gatsbyImg, label: '2 term sheets — Gatsby', legend: '2 · Gatsby', className: 'tier-2' },
  3: { image: godfatherImg, label: '3+ term sheets — Godfather', legend: '3+ · Godfather', className: 'tier-3' },
};

const TIER_ORDER: TermSheetTier[] = [3, 2, 1, 0];

function tierForCount(count: number): TermSheetTier {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

function countLabelForTier(tier: TermSheetTier, _counts: number[]): string {
  if (tier === 3) return '3+';
  return String(tier);
}

/** Lowercase, strip accents/punctuation, collapse spaces — Salesforce vs Entra name keys. */
function normalizeName(name: string): string {
  return name
    .normalize('NFD') // split accents off so the letters-only filter drops them
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Active Acquisitions Managers from Entra, or the static roster when the directory is unavailable. */
function rosterNames(directoryUsers: GraphUser[] | null | undefined): { displayName: string; keys: string[] }[] {
  const managers = (directoryUsers ?? []).filter((u) => isAcquisitionsManagerTitle(u.jobTitle));
  if (managers.length) {
    return managers.map((u) => ({
      displayName: u.displayName,
      keys: [u.displayName, [u.givenName, u.surname].filter(Boolean).join(' ')]
        .map(normalizeName)
        .filter(Boolean),
    }));
  }
  return TERM_SHEET_RANKING_ROSTER.map((entry) => ({
    displayName: entry.displayName,
    keys: [normalizeName(entry.displayName)],
  }));
}

/**
 * Every active manager (zeros included) with their live count. Salesforce names that don't
 * match a manager are still listed so a signed term sheet is never dropped.
 */
function mergeLiveCounts(
  directoryUsers: GraphUser[] | null | undefined,
  liveCounts: TermSheetCountRow[]
): LeaderboardPerson[] {
  const countByKey = new Map<string, TermSheetCountRow>();
  for (const row of liveCounts) countByKey.set(normalizeName(row.name), row);

  const matched = new Set<TermSheetCountRow>();
  const people = rosterNames(directoryUsers).map(({ displayName, keys }) => {
    const row = keys.map((k) => countByKey.get(k)).find(Boolean);
    if (row) matched.add(row);
    return { displayName, count: row?.count ?? 0 };
  });

  for (const row of liveCounts) {
    if (!matched.has(row)) people.push({ displayName: row.name, count: row.count });
  }
  return people;
}

/** Temporary: set to false to restore the real AM counts after the demo screenshot. */
const SHOW_DEMO_ATHLETES = false;

const DEMO_ATHLETES: LeaderboardPerson[] = [
  { name: 'Michael Jordan', count: 6 },
  { name: 'Tom Brady', count: 5 },
  { name: 'Serena Williams', count: 4 },
  { name: 'Wayne Gretzky', count: 3 },
  { name: 'LeBron James', count: 2 },
  { name: 'Lionel Messi', count: 2 },
  { name: 'Usain Bolt', count: 2 },
  { name: 'Carmelo Anthony', count: 1 },
  { name: 'Dwight Howard', count: 1 },
  { name: 'Happy Gilmore', count: 1 },
  { name: 'Bobby Boucher', count: 0 },
  { name: 'Ricky Bobby', count: 0 },
  { name: 'Kenny Powers', count: 0 },
].map(({ name, count }) => ({ displayName: name, count }));

function buildTierGroups(people: LeaderboardPerson[]): TierGroup[] {
  const byTier = new Map<TermSheetTier, LeaderboardPerson[]>();
  for (const person of people) {
    const tier = tierForCount(person.count);
    const list = byTier.get(tier) || [];
    list.push(person);
    byTier.set(tier, list);
  }

  return TIER_ORDER.map((tier) => {
    const members = (byTier.get(tier) || []).sort(
      (a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName)
    );
    return {
      tier,
      countLabel: countLabelForTier(
        tier,
        members.map((m) => m.count)
      ),
      members: members.map((m) => ({ name: m.displayName, count: m.count })),
    };
  });
}

function currentMonthLabel(date = new Date()): string {
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/** Re-check Salesforce this often while the page is open (matches the Lambda's cache). */
const REFRESH_MS = 5 * 60_000;
const CACHE_KEY = 'term-sheet-leaderboard:v1';

type CachedCounts = { month: string; counts: TermSheetCountRow[]; savedAt: number };

const monthKey = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** Last live counts saved in this browser — only for the current month (the board resets monthly). */
function readCachedCounts(): CachedCounts | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as CachedCounts | null;
    return cached && cached.month === monthKey() && Array.isArray(cached.counts) ? cached : null;
  } catch {
    return null;
  }
}

function writeCachedCounts(counts: TermSheetCountRow[]): number {
  const savedAt = Date.now();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ month: monthKey(), counts, savedAt }));
  } catch {
    /* storage unavailable (private window, blocked site data) — live counts still render */
  }
  return savedAt;
}

const countsEqual = (a: TermSheetCountRow[] | null, b: TermSheetCountRow[]): boolean =>
  !!a && JSON.stringify(a) === JSON.stringify(b);

interface TermSheetRankingsProps {
  /** Entra directory (from useDirectoryUsers); drives the roster of Acquisitions Managers. */
  directoryUsers?: GraphUser[] | null;
}

/**
 * Monthly Term Sheet Leaderboard. On `/` it is gated by isTermSheetRankingsAllowlisted.
 */
const TermSheetRankings: React.FC<TermSheetRankingsProps> = ({ directoryUsers }) => {
  // Show this browser's last saved live counts immediately, then refresh in the background.
  // null = no live counts yet (none saved and the fetch failed) → roster shown at 0 with a note.
  const [cached] = useState(readCachedCounts);
  const [liveCounts, setLiveCounts] = useState<TermSheetCountRow[] | null>(cached?.counts ?? null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(cached?.savedAt ?? null);
  // Spinner only when nothing is saved yet, so placeholder zeros don't flash before live data.
  const [loading, setLoading] = useState(!cached);
  const { instance, accounts, inProgress } = useMsal();
  const accountId = accounts[0]?.homeAccountId;
  // Fetch only once MSAL has a signed-in account; an earlier call would go out without a token.
  const signedIn = BYPASS_AUTH || (inProgress === InteractionStatus.None && !!accountId);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await intranetApiFetch(instance, SALESFORCE_TERM_SHEET_RANKINGS_URL, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`term-sheet-rankings failed (${res.status})`);
        const data: { counts?: unknown } = await res.json();
        if (!Array.isArray(data.counts)) throw new Error('term-sheet-rankings: missing counts');
        if (cancelled) return;
        const counts = data.counts as TermSheetCountRow[];
        setUpdatedAt(writeCachedCounts(counts));
        // Only re-render the board when a count actually changed.
        setLiveCounts((current) => (countsEqual(current, counts) ? current : counts));
      } catch (err) {
        console.warn('[TermSheetRankings] keeping saved counts:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    const intervalId = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [instance, signedIn, accountId]);

  const groups = useMemo(() => {
    if (SHOW_DEMO_ATHLETES) return buildTierGroups(DEMO_ATHLETES);
    return buildTierGroups(mergeLiveCounts(directoryUsers, liveCounts ?? []));
  }, [directoryUsers, liveCounts]);
  const monthLabel = useMemo(() => currentMonthLabel(), []);

  return (
    <section className="term-sheet-rankings" aria-label="Monthly Term Sheet Leaderboard">
      <header className="term-sheet-rankings-header">
        <h2>
          <span aria-hidden="true">🥇 🏆 </span>
          Monthly Term Sheet Leaderboard
          <span aria-hidden="true"> 🏆 🥇</span>
        </h2>
        <p className="term-sheet-rankings-month">
          Data for <strong>{monthLabel}</strong>
          <span className="term-sheet-rankings-reset"> · Resets monthly</span>
          {!loading && !liveCounts && (
            <span className="term-sheet-rankings-reset"> · Live counts unavailable</span>
          )}
          {updatedAt && (
            <span className="term-sheet-rankings-reset">
              {' · Updated '}
              {new Date(updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </p>      </header>

      {loading ? (
        <div className="term-sheet-rankings-loading" role="status" aria-label="Loading term sheet counts">
          <div className="app-loading-spinner" aria-hidden="true" />
        </div>
      ) : (
      <ul className="term-sheet-rankings-list">
        {groups.map((group) => {
          const tier = TIER_META[group.tier];
          return (
            <li key={group.tier} className={`term-sheet-rankings-row ${tier.className}`}>
              <img
                className="term-sheet-rankings-icon"
                src={tier.image}
                style={tier.imagePosition ? { objectPosition: tier.imagePosition } : undefined}
                alt={tier.label}
                title={tier.label}
              />
              <span className="term-sheet-rankings-names">
                {group.members.map((member, index) => (
                  <React.Fragment key={member.name}>
                    <span className="term-sheet-rankings-name">
                      {member.name}
                      {group.tier === 3 && (
                        <span className="term-sheet-rankings-name-count"> ({member.count})</span>
                      )}
                    </span>
                    {index < group.members.length - 1 && ', '}
                  </React.Fragment>
                ))}
              </span>
              <span
                className="term-sheet-rankings-count"
                title={`${group.countLabel} term sheet${group.countLabel === '1' ? '' : 's'} this month`}
              >
                {group.countLabel}
              </span>
            </li>
          );
        })}
      </ul>
      )}

      <div className="term-sheet-rankings-legend" aria-hidden="true">
        {TIER_ORDER.map((tierKey) => (
          <span key={tierKey} className="term-sheet-rankings-legend-item">
            <img
              src={TIER_META[tierKey].image}
              style={
                TIER_META[tierKey].imagePosition
                  ? { objectPosition: TIER_META[tierKey].imagePosition }
                  : undefined
              }
              alt=""
            />
            {TIER_META[tierKey].legend}
          </span>
        ))}
      </div>
    </section>
  );
};

export default TermSheetRankings;
