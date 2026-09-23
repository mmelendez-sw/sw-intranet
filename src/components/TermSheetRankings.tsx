import React, { useMemo } from 'react';
import '../../styles/term-sheet-rankings.css';

export type TermSheetTier = 0 | 1 | 2 | 3;

export type TermSheetRankingRow = {
  email: string;
  displayName: string;
  matchKey: string;
  count: number;
  tier: TermSheetTier;
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

function tierForCount(count: number): TermSheetTier {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

/**
 * Spoofed THIS_MONTH counts from sample Salesforce Opportunity rows
 * (Deal_Source_Individual__c / Id) — replace with live API when ready.
 */
const SPOOF_COUNTS: Array<{
  email: string;
  displayName: string;
  matchKey: string;
  count: number;
}> = [
  { email: 'NBocchi@symphonyinfra.com', displayName: 'Nick Bocchi', matchKey: 'Bocchi', count: 3 },
  { email: 'BSeidenberg@symphonyinfra.com', displayName: 'Brandon Seidenberg', matchKey: 'Seidenberg', count: 2 },
  { email: 'esanandaji@symphonyinfra.com', displayName: 'Ethan Sanandaji', matchKey: 'Sanandaji', count: 2 },
  { email: 'mkossak@symphonyinfra.com', displayName: 'Michael Kossak', matchKey: 'Kossak', count: 2 },
  { email: 'DKing@symphonyinfra.com', displayName: 'Dylan King', matchKey: 'King', count: 1 },
  { email: 'scasey@symphonyinfra.com', displayName: 'Shawn Casey', matchKey: 'Casey', count: 1 },
  { email: 'CPolidoro@symphonyinfra.com', displayName: 'C. Polidoro', matchKey: 'Polidoro', count: 0 },
  { email: 'DHall@symphonyinfra.com', displayName: 'D. Hall', matchKey: 'Hall', count: 0 },
  { email: 'SSchamberg@symphonyinfra.com', displayName: 'S. Schamberg', matchKey: 'Schamberg', count: 0 },
];

function buildSpoofRankings(): TermSheetRankingRow[] {
  return SPOOF_COUNTS.map((row) => ({
    ...row,
    tier: tierForCount(row.count),
  })).sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));
}

function currentMonthLabel(date = new Date()): string {
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Monthly Term Sheet Rankings — spoofed sample metrics for /dev sidebar sign-off.
 * Month label always tracks the current calendar month (e.g. September 2026).
 */
const TermSheetRankings: React.FC = () => {
  const rankings = useMemo(() => buildSpoofRankings(), []);
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
        {rankings.map((row) => {
          const tier = TIER_META[row.tier];
          return (
            <li key={row.email} className={`term-sheet-rankings-row ${tier.className}`}>
              <span className="term-sheet-rankings-icon" title={tier.label} aria-label={tier.label}>
                {tier.icon}
              </span>
              <span className="term-sheet-rankings-identity">
                <span className="term-sheet-rankings-name">{row.displayName}</span>
                <span className="term-sheet-rankings-email">{row.email}</span>
              </span>
              <span className="term-sheet-rankings-count" title={`${row.count} signed this month`}>
                {row.count}
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
