import React, { useEffect, useState } from 'react';
import { InteractionStatus } from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';
import '../../styles/deal-closed-banner.css';
import { BYPASS_AUTH, SALESFORCE_CLOSED_TODAY_URL } from '../authConfig';
import { intranetApiFetch } from '../services/intranetApi';

/** One row of GET /api/salesforce/closed-today → deals (mirrors ClosedDeal in server/salesforce.ts). */
export interface ClosedDeal {
  name: string;
  city: string;
  state: string;
  amName: string;
}

/** Matches the Lambda's cache, so a closing shows up within about 5 minutes. */
const REFRESH_MS = 5 * 60_000;
/** Dismissed deals for one day: `{ date, names }`. A deal that closes later still shows. */
const DISMISS_KEY = 'deal-closed-dismissed';

type Dismissed = { date: string; names: string[] };

function readDismissed(date: string): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(DISMISS_KEY) || 'null') as Dismissed | null;
    return new Set(saved && saved.date === date && Array.isArray(saved.names) ? saved.names : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(date: string, names: string[]): void {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ date, names }));
  } catch {
    /* storage blocked — hidden until reload */
  }
}

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

/** Some Site_City__c values are all caps ("CALIFON"); show those in title case. */
const cityCase = (city: string) =>
  city === city.toUpperCase() ? city.toLowerCase().replace(/[a-z]/g, (c) => c.toUpperCase()) : city;

const place = (d: ClosedDeal) => [d.city && cityCase(d.city), d.state].filter(Boolean).join(', ');

/**
 * Home page, everyone signed in: Proprietary deals whose Current_Investment_Date__c is today.
 * The AM who closed it gets a personal line. `previewDeals` renders fixed data (the /dev preview).
 */
const DealClosedBanner: React.FC<{ viewerName?: string; previewDeals?: ClosedDeal[] }> = ({
  viewerName,
  previewDeals,
}) => {
  const { instance, accounts, inProgress } = useMsal();
  const accountId = accounts[0]?.homeAccountId;
  const signedIn = BYPASS_AUTH || (inProgress === InteractionStatus.None && !!accountId);
  const [today, setToday] = useState<{ date: string; deals: ClosedDeal[] } | null>(
    previewDeals ? { date: 'preview', deals: previewDeals } : null
  );
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (previewDeals || !signedIn) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await intranetApiFetch(instance, SALESFORCE_CLOSED_TODAY_URL, { cache: 'no-store' });
        if (!res.ok) return;
        const data: { date?: unknown; deals?: unknown } = await res.json();
        if (cancelled || typeof data.date !== 'string' || !Array.isArray(data.deals)) return;
        const date = data.date;
        setDismissed(readDismissed(date));
        setToday({ date, deals: data.deals as ClosedDeal[] });
      } catch {
        /* Salesforce or the Lambda is down; the banner is a nice-to-have */
      }
    };
    void refresh();
    const intervalId = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [instance, signedIn, accountId, previewDeals]);

  const deals = (today?.deals ?? []).filter((d) => d.name && !dismissed.has(d.name));
  if (!today || !deals.length) return null;

  const viewer = viewerName ? normalizeName(viewerName) : '';
  const dismiss = () => {
    const names = [...dismissed, ...deals.map((d) => d.name)];
    setDismissed(new Set(names));
    if (!previewDeals) writeDismissed(today.date, names);
  };

  return (
    <div className="deal-closed-banner" role="status">
      <span className="deal-closed-icon" aria-hidden="true">🎉</span>
      <div className="deal-closed-text">
        {deals.map((d) => (
          <p key={d.name}>
            <strong>Deal closed today:</strong> {d.name}
            {place(d) && <span className="deal-closed-place"> ({place(d)})</span>}
            {d.amName && <> · {d.amName}</>}
            {viewer && d.amName && normalizeName(d.amName) === viewer && (
              <span className="deal-closed-you"> Congratulations, {viewerName!.trim().split(/\s+/)[0]}!</span>
            )}
          </p>
        ))}
      </div>
      <button type="button" className="deal-closed-dismiss" onClick={dismiss} aria-label="Dismiss">
        &times;
      </button>
    </div>
  );
};

export default DealClosedBanner;
