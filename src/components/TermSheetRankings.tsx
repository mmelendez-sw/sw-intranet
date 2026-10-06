import React, { useEffect, useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { SALESFORCE_TERM_SHEET_RANKINGS_URL } from '../authConfig';
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

/**
 * Fallback counts only — used when the live Salesforce endpoint is unreachable.
 * The roster still comes from Entra, so new Acquisitions Managers appear at 0.
 * THIS_MONTH counts keyed by matchKey, hand-copied from the Salesforce report.
 */
const SPOOF_COUNT_BY_KEY: Record<string, number> = {
  Bocchi: 1,
  King: 0,
  Sanandaji: 0,
  Kossak: 1,
  Seidenberg: 1,
  Schamberg: 0,
  Casey: 0,
  Polidoro: 0,
};

const SPOOF_COUNTS: TermSheetCountRow[] = TERM_SHEET_RANKING_ROSTER.map((entry) => ({
  name: entry.displayName,
  count: SPOOF_COUNT_BY_KEY[entry.matchKey] ?? 0,
})).filter((row) => row.count > 0);

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

interface TermSheetRankingsProps {
  /** Entra directory (from useDirectoryUsers); drives the roster of Acquisitions Managers. */
  directoryUsers?: GraphUser[] | null;
}

/**
 * Monthly Term Sheet Leaderboard. On `/` it is gated by isTermSheetRankingsAllowlisted.
 */
const TermSheetRankings: React.FC<TermSheetRankingsProps> = ({ directoryUsers }) => {
  // null = live counts unavailable (endpoint not deployed / failed) → hand-copied fallback.
  const [liveCounts, setLiveCounts] = useState<TermSheetCountRow[] | null>(null);
  const { instance } = useMsal();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await intranetApiFetch(instance, SALESFORCE_TERM_SHEET_RANKINGS_URL, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`term-sheet-rankings failed (${res.status})`);
        const data: { counts?: unknown } = await res.json();
        if (!Array.isArray(data.counts)) throw new Error('term-sheet-rankings: missing counts');
        if (!cancelled) setLiveCounts(data.counts as TermSheetCountRow[]);
      } catch (err) {
        console.warn('[TermSheetRankings] using fallback counts:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instance]);

  const groups = useMemo(() => {
    if (SHOW_DEMO_ATHLETES) return buildTierGroups(DEMO_ATHLETES);
    return buildTierGroups(mergeLiveCounts(directoryUsers, liveCounts ?? SPOOF_COUNTS));
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
        </p>      </header>

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
