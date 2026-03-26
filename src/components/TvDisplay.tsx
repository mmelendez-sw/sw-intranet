/**
 * TvDisplay.tsx  —  Route: /tv
 *
 * Standalone full-screen card display for office TV / kiosk screens.
 * No navigation, no sidebar, no authentication UI.
 *
 * Auth strategy
 * ─────────────
 * Attempts MSAL acquireTokenSilent using any cached account (works invisibly
 * on domain-joined Windows machines running Edge).  If no token is available,
 * falls back to the bundled DEFAULT_CARDS so the screen always shows something.
 *
 * Content refresh: every 5 minutes automatically.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../authConfig';
import {
  getContent,
  DEFAULT_CARDS,
  CardContent,
} from '../services/contentService';

import '../../styles/tv-display.css';

// ── Local fallback images (same as HomePage) ───────────────────────────────
import img3  from '../../images/site_3.jpg';
import img4  from '../../images/coat.jpg';
import img7  from '../../images/mm2.jpg';
import img9  from '../../images/vol.jpg';
import img10 from '../../images/emp.jpg';
import img11 from '../../images/sip.jpeg';
import logo  from '../../images/sti-horizontal-white.png';

const LOCAL_IMAGES: Record<number, string> = {
  1: img9,
  2: img11,
  3: img7,
  4: img4,
  5: img3,
  6: img10,
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ── Clock component ────────────────────────────────────────────────────────
const LiveClock: React.FC = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="tv-topbar-right">
      <div className="tv-clock">{timeStr}</div>
      <div className="tv-date">{dateStr}</div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
const TvDisplay: React.FC = () => {
  const { instance } = useMsal();
  const [cards, setCards] = useState<CardContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCards = useCallback(async () => {
    // Try silent auth first — works on domain-joined machines with no prompt
    try {
      const accounts = instance.getAllAccounts();
      if (accounts.length > 0) {
        await instance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
      }
    } catch {
      // Silent auth failed — content service will also fail and we'll use defaults
    }

    const remote = await getContent<CardContent[]>(instance, 'homepage-cards');
    const sorted = [...(remote ?? DEFAULT_CARDS)].sort((a, b) => a.order - b.order);
    setCards(sorted);
    setLoading(false);
    setLastRefresh(new Date());
  }, [instance]);

  // Initial load + periodic refresh
  useEffect(() => {
    loadCards();
    refreshTimerRef.current = setInterval(loadCards, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [loadCards]);

  const renderImage = (card: CardContent, displayIdx: number) => {
    const src = card.imageUrl || LOCAL_IMAGES[displayIdx + 1] || LOCAL_IMAGES[1];
    return (
      <div className="tv-card-img-wrap">
        <img src={src} alt={card.title} loading="lazy" />
      </div>
    );
  };

  const refreshLabel = lastRefresh
    ? `Last refreshed ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Loading…';

  return (
    <div className="tv-root">
      {/* ── Top bar ── */}
      <div className="tv-topbar">
        <div className="tv-topbar-left">
          <img src={logo} alt="Symphony Towers Infrastructure" className="tv-topbar-logo" />
          <span className="tv-topbar-title">Symphony Towers Infrastructure</span>
        </div>
        <LiveClock />
      </div>

      {/* ── Card grid ── */}
      {loading ? (
        <div className="tv-loading">
          <span>Loading<span className="tv-loading-dots" /></span>
        </div>
      ) : (
        <div className="tv-grid">
          {cards.map((card, idx) => (
            <div key={card.order} className="tv-card">
              {renderImage(card, idx)}
              <div className="tv-card-body">
                <h2 className="tv-card-title">{card.title}</h2>
                <ul className="tv-card-bullets">
                  {card.bullets.map((bullet, bi) => (
                    <li key={bi} dangerouslySetInnerHTML={{ __html: bullet }} />
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="tv-footer">
        <span className="tv-footer-text">
          &copy; {new Date().getFullYear()} Symphony Towers Infrastructure &mdash; Internal Display Only
        </span>
        <span className="tv-footer-refresh">{refreshLabel} &bull; Auto-refreshes every 5 min</span>
      </div>
    </div>
  );
};

export default TvDisplay;
