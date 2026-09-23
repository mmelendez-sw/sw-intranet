import React, { useMemo } from 'react';
import '../../styles/term-sheet-rankings.css';

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
  names: string[];
};

const TIER_META: Record<
  TermSheetTier,
  { icon: string; label: string; className: string }
> = {
  0: { icon: '💩', label: '0 term sheets', className: 'tier-0' },
  1: { icon: '🧒', label: '1 term sheet (child)', className: 'tier-1' },
  2: { icon: '🎬', label: '2 term sheets — Godfather goal', className: 'tier-2' },
  3: { icon: '🐐', label: '3+ term sheets — Jordan', className: 'tier-3' },
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
 * Spoofed THIS_MONTH counts from sample Salesforce Opportunity rows
 * (Deal_Source_Individual__c / Id) — replace with live API when ready.
 */
const SPOOF_COUNTS: SpoofPerson[] = [
  { email: 'NBocchi@symphonyinfra.com', displayName: 'Nick Bocchi', matchKey: 'Bocchi', count: 3 },
  { email: 'BSeidenberg@symphonyinfra.com', displayName: 'Brandon Seidenberg', matchKey: 'Seidenberg', count: 2 },
  { email: 'esanandaji@symphonyinfra.com', displayName: 'Ethan Sanandaji', matchKey: 'Sanandaji', count: 2 },
  { email: 'mkossak@symphonyinfra.com', displayName: 'Michael Kossak', matchKey: 'Kossak', count: 2 },
  { email: 'DKing@symphonyinfra.com', displayName: 'Dylan King', matchKey: 'King', count: 1 },
  { email: 'scasey@symphonyinfra.com', displayName: 'Shawn Casey', matchKey: 'Casey', count: 1 },
  { email: 'CPolidoro@symphonyinfra.com', displayName: 'Chris Polidoro', matchKey: 'Polidoro', count: 0 },
  { email: 'SSchamberg@symphonyinfra.com', displayName: 'Steve Schamberg', matchKey: 'Schamberg', count: 0 },
];

function buildTierGroups(people: SpoofPerson[]): TierGroup[] {
  const byTier = new Map<TermSheetTier, SpoofPerson[]>();
  for (const person of people) {
    const tier = tierForCount(person.count);
    const list = byTier.get(tier) || [];
    list.push(person);
    byTier.set(tier, list);
  }

  return TIER_ORDER.filter((tier) => byTier.has(tier)).map((tier) => {
    const members = (byTier.get(tier) || []).sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
    return {
      tier,
      countLabel: countLabelForTier(
        tier,
        members.map((m) => m.count)
      ),
      names: members.map((m) => m.displayName),
    };
  });
}

function currentMonthLabel(date = new Date()): string {
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Monthly Term Sheet Rankings — spoofed sample metrics for /dev sidebar sign-off.
 * People with the same tier (0 / 1 / 2 / 3+) share one row.
 */
const TermSheetRankings: React.FC = () => {
  const groups = useMemo(() => buildTierGroups(SPOOF_COUNTS), []);
  const monthLabel = useMemo(() => currentMonthLabel(), []);

  return (
    <section className="term-sheet-rankings" aria-label="Monthly Term Sheet Rankings">
      <header className="term-sheet-rankings-header">
        <h2>Monthly Term Sheet Rankings</h2>
        <p className="term-sheet-rankings-month">
          Data for <strong>{monthLabel}</strong>
          <span className="term-sheet-rankings-reset"> · Resets monthly</span>
        </p>
        <p className="term-sheet-rankings-spoof-note">Sample Salesforce metrics (preview)</p>
      </header>

      <ul className="term-sheet-rankings-list">
        {groups.map((group) => {
          const tier = TIER_META[group.tier];
          return (
            <li key={group.tier} className={`term-sheet-rankings-row ${tier.className}`}>
              <span className="term-sheet-rankings-icon" title={tier.label} aria-label={tier.label}>
                {tier.icon}
              </span>
              <span className="term-sheet-rankings-names">
                {group.names.map((name) => (
                  <span key={name} className="term-sheet-rankings-name">
                    {name}
                  </span>
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
        <span>💩 0</span>
        <span>🧒 1</span>
        <span>🎬 2 Godfather</span>
        <span>🐐 3+ Jordan</span>
      </div>
    </section>
  );
};

export default TermSheetRankings;
