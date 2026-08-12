import React, { useEffect, useRef, useState } from 'react';
import '../../styles/home-page.css';
import { UserInfo } from '../types/user';
import { TV_CARDS_API_URL } from '../authConfig';
import {
  CardContent,
  DEFAULT_CARDS,
  fetchTvHomepageCardsFromApi,
  fetchTvHomepageCardsMetaFromApi,
  normalizeTvCards,
  tvHomepageCardsMetaFingerprint,
} from '../services/tvCardsService';

import img2 from '../../images/site_2.jpg';
import img3 from '../../images/site_3.jpg';
import img11 from '../../images/wider_app.png';

interface HomePageProps {
  userInfo: UserInfo;
}

const META_POLL_INTERVAL_MS = 20_000;
const BUNDLED_FALLBACK_IMAGES = [img2, img11, img3];

const getBundledFallbackImage = (index: number): string =>
  BUNDLED_FALLBACK_IMAGES[index % BUNDLED_FALLBACK_IMAGES.length];

const HomePage: React.FC<HomePageProps> = () => {
  const [cards, setCards] = useState<CardContent[]>(() =>
    normalizeTvCards(DEFAULT_CARDS, TV_CARDS_API_URL)
  );
  const metaFingerprintRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;

    const loadCards = async () => {
      const raw = await fetchTvHomepageCardsFromApi(TV_CARDS_API_URL);
      if (cancelled || raw == null) return;
      const next = normalizeTvCards(raw, TV_CARDS_API_URL);
      if (next.length) setCards(next);
    };

    const pollMeta = async () => {
      const meta = await fetchTvHomepageCardsMetaFromApi(TV_CARDS_API_URL);
      if (cancelled || !meta) return;
      const fingerprint = tvHomepageCardsMetaFingerprint(meta);
      if (!metaFingerprintRef.current) {
        metaFingerprintRef.current = fingerprint;
        return;
      }
      if (fingerprint !== metaFingerprintRef.current) {
        metaFingerprintRef.current = fingerprint;
        await loadCards();
      }
    };

    loadCards();
    const id = window.setInterval(pollMeta, META_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="home-page authenticated home-page-progress">
      <div className="home-page-progress-layout">
        <div className="content-container home-page-progress-container">
          <div
            className="homepage-cards-section"
            style={{
              order: 2,
              width: '100%',
              maxWidth: 'none',
              margin: '8px auto 0',
              padding: '4px 16px 0',
              boxSizing: 'border-box',
            }}
          >
            <div className="grid-layout">
              {cards.map((card, idx) => {
                const imageSrc =
                  (card.imageUrl && card.imageUrl.trim()) || getBundledFallbackImage(idx);
                const parityClass = idx % 2 === 0 ? 'odd-card' : 'even-card';
                return (
                  <div key={`${card.order}-${card.title}`} className={`card ${parityClass}`}>
                    <img src={imageSrc} alt={card.title} className="card-image" />
                    <div className="card-text">
                      <h2>{card.title}</h2>
                      <ul>
                        {card.bullets.map((bullet, bi) => (
                          <li key={bi} dangerouslySetInnerHTML={{ __html: bullet }} />
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="main-content home-page-progress-main" style={{ order: 1 }} />
        </div>
      </div>
    </div>
  );
};

export default HomePage;
