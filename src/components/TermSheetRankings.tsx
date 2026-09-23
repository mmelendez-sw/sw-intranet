import React, { useEffect, useState } from 'react';
import { SALESFORCE_TERM_SHEET_RANKINGS_URL } from '../authConfig';
import '../../styles/term-sheet-rankings.css';

export type TermSheetTier = 0 | 1 | 2 | 3;

export type TermSheetRankingRow = {
  email: string;
  displayName: string;
  matchKey: string;
  count: number;
  tier: TermSheetTier;
  dealSourceLabel: string | null;
};

type RankingsResponse = {
  monthLabel?: string;
  rankings?: TermSheetRankingRow[];
  error?: string;
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

/**
 * Monthly Term Sheet Rankings — Salesforce THIS_MONTH signed counts for the AM roster.
 * Mounted at the top of the /dev sidebar.
 */
const TermSheetRankings: React.FC = () => {
  const [rankings, setRankings] = useState<TermSheetRankingRow[]>([]);
  const [monthLabel, setMonthLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(SALESFORCE_TERM_SHEET_RANKINGS_URL);
        const data = (await response.json().catch(() => ({}))) as RankingsResponse;
        if (!response.ok) {
          throw new Error(data.error || `Salesforce request failed (${response.status})`);
        }
        if (!active) return;
        setRankings(data.rankings || []);
        setMonthLabel(data.monthLabel || '');
      } catch (err) {
        console.error('[TermSheetRankings]', err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load rankings.');
          setRankings([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="term-sheet-rankings" aria-label="Monthly Term Sheet Rankings">
      <header className="term-sheet-rankings-header">
        <h2>Monthly Term Sheet Rankings</h2>
        {monthLabel ? <p className="term-sheet-rankings-month">{monthLabel}</p> : null}
      </header>

      {loading && <div className="term-sheet-rankings-status">Loading Salesforce…</div>}
      {error && !loading && <div className="term-sheet-rankings-error">{error}</div>}

      {!loading && !error && (
        <>
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
        </>
      )}
    </section>
  );
};

export default TermSheetRankings;
