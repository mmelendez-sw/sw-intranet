/**
 * TvDisplay.tsx  —  Route: /tv
 *
 * Standalone full-screen card display for office TV / kiosk screens.
 * No navigation, no sidebar, no authentication UI.
 *
 * Cards are loaded from homepage-cards.json via:
 *   1. TV_CARDS_API_URL — client-credentials API (server/handler.ts) for kiosks
 *   2. MSAL + direct Graph drive/item fetch (fallback)
 *
 * Content refresh: every 5 minutes automatically.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest, TV_CARDS_API_URL } from '../authConfig';
import {
  getContent,
  fetchTvHomepageCardsFromApi,
  fetchTvHomepageCardsRaw,
  DEFAULT_CARDS,
  parseHomepageCardsContent,
  preloadSharePointImages,
  fetchDefaultFallbackImageUrls,
  pickDefaultFallbackImageUrl,
  CardContent,
} from '../services/contentService';
import SharePointImage from './SharePointImage';

import '../../styles/tv-display.css';

import logo from '../../images/sti-horizontal-white.png';

const normalizeTvCards = (remoteCards: CardContent[]): CardContent[] =>
  [...remoteCards].sort((a, b) => a.order - b.order);

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
  const [defaultFallbackImageUrls, setDefaultFallbackImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCards = useCallback(async () => {
    let remote: unknown = null;

    // Prefer client-credentials API (kiosk / no user session)
    if (TV_CARDS_API_URL) {
      remote = await fetchTvHomepageCardsFromApi(TV_CARDS_API_URL);
    }

    if (!remote) {
      try {
        const accounts = instance.getAllAccounts();
        if (accounts.length > 0) {
          await instance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
        }
      } catch {
        // Silent auth failed — try Graph drive fetch or defaults below
      }

      remote = await fetchTvHomepageCardsRaw(instance);
      if (!remote) {
        remote = await getContent<unknown>(instance, 'homepage-cards');
      }
    }

    const parsed = parseHomepageCardsContent(remote);
    const sorted = normalizeTvCards(parsed.length ? parsed : DEFAULT_CARDS);
    setCards(sorted);
    setLoading(false);
    setLastRefresh(new Date());
  }, [instance]);

  // Load Default Images folder listing (size drives cycle length)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const urls = await fetchDefaultFallbackImageUrls(instance);
      if (!cancelled) setDefaultFallbackImageUrls(urls);
    })();
    return () => {
      cancelled = true;
    };
  }, [instance]);

  // Preload SharePoint card / default images when known
  useEffect(() => {
    const urls = [
      ...defaultFallbackImageUrls,
      ...cards.map(
        (card, index) =>
          card.imageUrl || pickDefaultFallbackImageUrl(defaultFallbackImageUrls, index)
      ),
    ];
    if (urls.length) preloadSharePointImages(instance, urls);
  }, [cards, defaultFallbackImageUrls, instance]);

  // Initial load + periodic refresh
  useEffect(() => {
    loadCards();
    refreshTimerRef.current = setInterval(loadCards, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [loadCards]);

  const renderImage = (card: CardContent, index: number) => {
    const imageSrc =
      card.imageUrl || pickDefaultFallbackImageUrl(defaultFallbackImageUrls, index);
    if (!imageSrc) return null;

    return (
      <div className="tv-card-img-wrap">
        <SharePointImage
          src={imageSrc}
          alt={card.title}
          className="tv-card-image"
          loading="lazy"
        />
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
            <article
              key={card.order}
              className={`tv-card${idx % 2 === 1 ? ' tv-card-even' : ''}`}
            >
              {renderImage(card, idx)}
              <div className="tv-card-body">
                <h2 className="tv-card-title">{card.title}</h2>
                <ul className="tv-card-bullets">
                  {card.bullets.map((bullet, bi) => (
                    <li key={bi} dangerouslySetInnerHTML={{ __html: bullet }} />
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="tv-footer">
        <span className="tv-footer-text">
          © {new Date().getFullYear()} — Internal Display Only
        </span>
        <span className="tv-footer-refresh">{refreshLabel}</span>
      </div>
    </div>
  );
};

export default TvDisplay;
