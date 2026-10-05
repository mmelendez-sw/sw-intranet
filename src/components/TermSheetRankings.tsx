import React, { useMemo } from 'react';
import { TERM_SHEET_RANKING_ROSTER } from '../data/termSheetRankingsRoster';
import '../../styles/term-sheet-rankings.css';
import awkwardKidImg from '../../images/term-sheet-rankings/awkward-kid.png';
import awesomeKidImg from '../../images/term-sheet-rankings/awesome-kid.png';
import gatsbyImg from '../../images/term-sheet-rankings/gatsby.png';
import godfatherImg from '../../images/term-sheet-rankings/godfather.png';

export type TermSheetTier = 0 | 1 | 2 | 3;

type SpoofPerson = {
  email: string;
  displayName: string;
  matchKey: string;
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

export function tierForCount(count: number): TermSheetTier {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

function countLabelForTier(tier: TermSheetTier, _counts: number[]): string {
  if (tier === 3) return '3+';
  return String(tier);
}

/** THIS_MONTH counts keyed by matchKey, hand-copied from the Salesforce report — replace with live API when ready. */
const SPOOF_COUNT_BY_KEY: Record<string, number> = {
  Bocchi: 1,
  King: 0,
  Sanandaji: 0,
  Kossak: 0,
  Seidenberg: 1,
  Schamberg: 0,
  Casey: 0,
  Polidoro: 0,
};

const SPOOF_COUNTS: SpoofPerson[] = TERM_SHEET_RANKING_ROSTER.map((entry) => ({
  email: entry.email,
  displayName: entry.displayName,
  matchKey: entry.matchKey,
  count: SPOOF_COUNT_BY_KEY[entry.matchKey] ?? 0,
}));

/** Temporary: set to false to restore the real AM counts after the demo screenshot. */
const SHOW_DEMO_ATHLETES = false;

const DEMO_ATHLETES: SpoofPerson[] = [
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
].map(({ name, count }) => ({ email: '', displayName: name, matchKey: name, count }));

export function buildTierGroups(people: SpoofPerson[]): TierGroup[] {
  const byTier = new Map<TermSheetTier, SpoofPerson[]>();
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

/**
 * Monthly Term Sheet Leaderboard. On `/` it is gated by isTermSheetRankingsAllowlisted.
 */
const TermSheetRankings: React.FC = () => {
  const groups = useMemo(
    () => buildTierGroups(SHOW_DEMO_ATHLETES ? DEMO_ATHLETES : SPOOF_COUNTS),
    []
  );
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
