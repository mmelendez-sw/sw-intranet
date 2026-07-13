/**
 * TvDisplay.tsx  —  Route: /tv
 *
 * Standalone full-screen card display for office TV / kiosk screens.
 * No navigation, no sidebar. Works with no login and no TV API:
 *   cards → browser cache → bundled seed
 *   empty imageUrl → SharePoint Default Images (if signed in) → bundled assets
 *
 * Optional:
 *   1. TV_CARDS_API_URL — client-credentials API (npm run tv-api / Lambda)
 *   2. MSAL silent token — live SharePoint cards + Default Images folder
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { loginRequest, TV_CARDS_API_URL } from '../authConfig';
import {
  getContent,
  getCachedContent,
  fetchTvHomepageCardsFromApi,
  fetchTvHomepageCardsRaw,
  fetchTvHomepageCardsMetaFromApi,
  fetchTvHomepageCardsMeta,
  tvHomepageCardsMetaFingerprint,
  DEFAULT_CARDS,
  parseHomepageCardsContent,
  preloadSharePointImages,
  isSharePointImageUrl,
  refreshDefaultFallbackImages,
  getDefaultFallbackImageDisplaySrc,
  DriveItem,
  CardContent,
} from '../services/contentService';
import SharePointImage from './SharePointImage';

import '../../styles/tv-display.css';

import logo from '../../images/sti-horizontal-white.png';

const normalizeTvCards = (remoteCards: CardContent[]): CardContent[] =>
  [...remoteCards].sort((a, b) => a.order - b.order);

const META_POLL_INTERVAL_MS = 20_000;
const CARDS_CACHE_KEY = 'homepage-cards';

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
  const isAuthenticated = useIsAuthenticated();
  const [cards, setCards] = useState<CardContent[]>(() =>
    normalizeTvCards(DEFAULT_CARDS)
  );
  const [defaultFallbackImages, setDefaultFallbackImages] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [loadSource, setLoadSource] = useState<string>('seed');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [signingIn, setSigningIn] = useState(false);
  const metaFingerprintRef = useRef<string | null>(null);
  const metaPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshDefaultImages = useCallback(async () => {
    // Only useful when signed in (Graph list). Bundled images cover anonymous /tv.
    if (instance.getAllAccounts().length === 0) {
      setDefaultFallbackImages([]);
      return;
    }
    const images = await refreshDefaultFallbackImages(instance);
    setDefaultFallbackImages(images);
  }, [instance]);

  const loadCards = useCallback(async () => {
    let remote: unknown = null;
    let source = '';

    if (TV_CARDS_API_URL) {
      remote = await fetchTvHomepageCardsFromApi(TV_CARDS_API_URL);
      if (remote) source = 'tv-api';
    }

    if (!remote) {
      try {
        const accounts = instance.getAllAccounts();
        if (accounts.length > 0) {
          await instance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
        }
      } catch {
        // Silent auth failed — try Graph / cache below
      }

      remote = await fetchTvHomepageCardsRaw(instance);
      if (remote) source = 'graph';
      if (!remote) {
        remote = await getContent<unknown>(instance, CARDS_CACHE_KEY);
        if (remote) source = 'content-service';
      }
    }

    if (!remote) {
      remote = getCachedContent<unknown>(CARDS_CACHE_KEY);
      if (remote) source = 'browser-cache';
    }

    const parsed = parseHomepageCardsContent(remote);
    const sorted = normalizeTvCards(parsed.length ? parsed : DEFAULT_CARDS);
    if (!parsed.length) source = source || 'seed';
    setCards(sorted);
    setLoading(false);
    setLastRefresh(new Date());
    setLoadSource(source);
    setStatusMessage(source ? `Loaded via ${source}` : '');

    await refreshDefaultImages();
  }, [instance, refreshDefaultImages]);

  const pollMetaAndReloadIfChanged = useCallback(async () => {
    let meta = null as Awaited<ReturnType<typeof fetchTvHomepageCardsMetaFromApi>>;

    if (TV_CARDS_API_URL) {
      meta = await fetchTvHomepageCardsMetaFromApi(TV_CARDS_API_URL);
    }

    if (!meta) {
      try {
        const accounts = instance.getAllAccounts();
        if (accounts.length > 0) {
          await instance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
        }
      } catch {
        // ignore
      }
      meta = await fetchTvHomepageCardsMeta(instance);
    }

    if (!meta) return;

    const fingerprint = tvHomepageCardsMetaFingerprint(meta);
    if (!fingerprint || fingerprint === '|') return;

    if (metaFingerprintRef.current === null) {
      metaFingerprintRef.current = fingerprint;
      return;
    }

    if (fingerprint !== metaFingerprintRef.current) {
      metaFingerprintRef.current = fingerprint;
      await loadCards();
    }
  }, [instance, loadCards]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await loadCards();
      if (cancelled) return;
      await pollMetaAndReloadIfChanged();
    })();

    metaPollTimerRef.current = setInterval(() => {
      void pollMetaAndReloadIfChanged();
    }, META_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (metaPollTimerRef.current) clearInterval(metaPollTimerRef.current);
    };
  }, [loadCards, pollMetaAndReloadIfChanged]);

  useEffect(() => {
    const urls = cards
      .map((card, index) => {
        if (card.imageUrl?.trim()) return card.imageUrl;
        return getDefaultFallbackImageDisplaySrc(index, defaultFallbackImages) || undefined;
      })
      .filter((url): url is string => !!url && isSharePointImageUrl(url));
    if (urls.length) preloadSharePointImages(instance, urls);
  }, [cards, defaultFallbackImages, instance]);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      console.warn('[TvDisplay] loginRedirect failed:', err);
      setSigningIn(false);
      setStatusMessage('Sign-in failed. Check the console for details.');
    }
  };

  const renderImage = (card: CardContent, index: number) => {
    // Empty imageUrl → SharePoint Default Images when listed, else bundled SPA assets
    const imageSrc =
      (card.imageUrl && card.imageUrl.trim()) ||
      getDefaultFallbackImageDisplaySrc(index, defaultFallbackImages);
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
    ? `Updated ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Loading…';

  return (
    <div className="tv-root">
      <div className="tv-topbar">
        <div className="tv-topbar-left">
          <img src={logo} alt="Symphony Towers Infrastructure" className="tv-topbar-logo" />
        </div>
        <LiveClock />
      </div>

      {loading ? (
        <div className="tv-loading">
          <span>Loading<span className="tv-loading-dots" /></span>
        </div>
      ) : cards.length === 0 ? (
        <div className="tv-empty">
          <p className="tv-empty-title">No cards to display</p>
          <p className="tv-empty-detail">{statusMessage || 'Could not load homepage cards.'}</p>
          {!isAuthenticated && (
            <button
              type="button"
              className="tv-signin-btn"
              onClick={handleSignIn}
              disabled={signingIn}
            >
              {signingIn ? 'Signing in…' : 'Sign in to load cards'}
            </button>
          )}
          {isAuthenticated && (
            <button type="button" className="tv-signin-btn" onClick={() => void loadCards()}>
              Retry load
            </button>
          )}
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

      <div className="tv-footer">
        <span className="tv-footer-text">
          © {new Date().getFullYear()} — Internal Display Only
          {loadSource ? ` · ${loadSource}` : ''}
        </span>
        <span className="tv-footer-refresh">{refreshLabel}</span>
      </div>
    </div>
  );
};

export default TvDisplay;
