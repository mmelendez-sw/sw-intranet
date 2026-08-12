import React, { useCallback, useEffect, useState } from 'react';
// import { service, factories, models } from 'powerbi-client';
import '../../styles/home-page.css';
import { UserInfo } from '../types/user';
// import { PowerbiService, PowerbiEmbedToken } from '../services/powerbiService';
import { TV_CARDS_API_URL } from '../authConfig';
import {
  CardContent,
  parseHomepageCardsContent,
  fetchTvHomepageCardsFromApi,
  getDefaultFallbackImageDisplaySrc,
  resolveTvMediaUrl,
} from '../services/tvCardsClient';
import SharePointImage from './SharePointImage';
import seedCards from '../data/homepage-cards.seed.json';
import howBanner from '../../images/H.O.W.-banner.png';
import img2 from '../../images/site_2.jpg';
import img3 from '../../images/site_3.jpg';
import img11 from '../../images/wider_app.png';

// const powerbiEmbedService = new service.Service(
//   factories.hpmFactory,
//   factories.wpmpFactory,
//   factories.routerFactory
// );

interface HomePageProps {
  userInfo: UserInfo;
}

interface SalesforceInvestmentRecord {
  Id: string;
  All_In_Purchase_Price__c?: number | null;
  Annual_Rent__c?: number | null;
  Source_Type__c?: string | null;
}

interface SalesforceInvestmentResponse {
  records?: SalesforceInvestmentRecord[];
}

const SALESFORCE_CURRENT_INVESTMENTS_URL = (() => {
  if (typeof window === 'undefined') return '/api/salesforce/current-investments';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:3001/api/salesforce/current-investments';
  }
  return '/api/salesforce/current-investments';
})();

const CLOSED_RENT_MAX = 250;
const CLOSED_RENT_GOAL = 104;
const CAPITAL_DEPLOYED_MAX = 210_000_000;
const CAPITAL_DEPLOYED_GOAL = 82_000_000;

const getGaugePoint = (value: number, max: number, radius: number) => {
  const centerX = 150;
  const centerY = 150;
  const ratio = Math.max(0, Math.min(value / max, 1));
  const angle = Math.PI - (ratio * Math.PI);

  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY - radius * Math.sin(angle),
  };
};

const toNumber = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return value;
};

const formatMillions = (value: number) => `$${Math.round(value / 1_000_000)}M`;
const formatMillionsPrecise = (value: number) => `$${(value / 1_000_000).toFixed(2)}M`;

const getProgressMetrics = (
  rows: SalesforceInvestmentRecord[],
  closedRentGoal: number,
  capitalDeployedGoal: number
) => {
  const closedRentCount = rows.length;
  const closedRentPercent = Math.min((closedRentCount / CLOSED_RENT_MAX) * 100, 100);
  const goalInnerPoint = getGaugePoint(closedRentGoal, CLOSED_RENT_MAX, 97);
  const goalOuterPoint = getGaugePoint(closedRentGoal, CLOSED_RENT_MAX, 143);
  const capitalDeployed = rows.reduce(
    (total, row) => total + toNumber(row.All_In_Purchase_Price__c),
    0
  );
  const capitalDeployedPercent = Math.min((capitalDeployed / CAPITAL_DEPLOYED_MAX) * 100, 100);
  const capitalGoalInnerPoint = getGaugePoint(capitalDeployedGoal, CAPITAL_DEPLOYED_MAX, 97);
  const capitalGoalOuterPoint = getGaugePoint(capitalDeployedGoal, CAPITAL_DEPLOYED_MAX, 143);
  const gcfAcquired = rows.reduce(
    (total, row) => total + toNumber(row.Annual_Rent__c),
    0
  );

  return {
    closedRentCount,
    closedRentPercent,
    closedRentGoal,
    goalInnerPoint,
    goalOuterPoint,
    capitalDeployed,
    capitalDeployedPercent,
    capitalDeployedGoal,
    capitalGoalInnerPoint,
    capitalGoalOuterPoint,
    gcfAcquired,
  };
};

interface ProgressSectionProps {
  title: string;
  rows: SalesforceInvestmentRecord[];
  loading: boolean;
  error: string | null;
  closedRentGoal?: number;
  capitalDeployedGoal?: number;
  featured?: boolean;
}

const ProgressSection: React.FC<ProgressSectionProps> = ({
  title,
  rows,
  loading,
  error,
  closedRentGoal = CLOSED_RENT_GOAL,
  capitalDeployedGoal = CAPITAL_DEPLOYED_GOAL,
  featured = false,
}) => {
  const metrics = getProgressMetrics(rows, closedRentGoal, capitalDeployedGoal);

  return (
    <section className={`company-progress-box${featured ? ' company-progress-box--featured' : ''}`}>
      <div className="company-progress-box-header">
        <h2>{title}</h2>
      </div>
      <div className="salesforce-gauge-row">
        <section className="salesforce-panel">
          <div className="salesforce-panel-header">
            <h2>Closed Rent (#)</h2>
          </div>
          {loading ? (
            <div className="salesforce-status">Loading Salesforce data...</div>
          ) : error ? (
            <div className="salesforce-error">{error}</div>
          ) : (
            <div className="closed-rent-gauge">
              <div className="salesforce-panel-goal">Goal : {metrics.closedRentGoal}</div>
              <svg className="closed-rent-gauge-svg" viewBox="0 -28 300 218" role="img" aria-label={`Closed Rent count ${metrics.closedRentCount} out of ${CLOSED_RENT_MAX}`}>
                <path
                  className="closed-rent-gauge-track"
                  d="M 30 150 A 120 120 0 0 1 270 150"
                  pathLength={100}
                />
                <path
                  className="closed-rent-gauge-fill"
                  d="M 30 150 A 120 120 0 0 1 270 150"
                  pathLength={100}
                  strokeDasharray={`${metrics.closedRentPercent} 100`}
                />
                <line
                  className="closed-rent-gauge-goal"
                  x1={metrics.goalInnerPoint.x}
                  y1={metrics.goalInnerPoint.y}
                  x2={metrics.goalOuterPoint.x}
                  y2={metrics.goalOuterPoint.y}
                />
              </svg>
              <div className="closed-rent-gauge-value">{metrics.closedRentCount}</div>
              <div className="closed-rent-gauge-scale">
                <span>0</span>
                <span>{CLOSED_RENT_MAX}</span>
              </div>
            </div>
          )}
        </section>

        <section className="salesforce-panel">
          <div className="salesforce-panel-header">
            <h2>Capital Deployed</h2>
          </div>
          {loading ? (
            <div className="salesforce-status">Loading Salesforce data...</div>
          ) : error ? (
            <div className="salesforce-error">{error}</div>
          ) : (
            <div className="closed-rent-gauge">
              <div className="salesforce-panel-goal">Goal : {formatMillions(metrics.capitalDeployedGoal)}</div>
              <svg className="closed-rent-gauge-svg" viewBox="0 -28 300 218" role="img" aria-label={`Capital Deployed ${formatMillions(metrics.capitalDeployed)} out of ${formatMillions(CAPITAL_DEPLOYED_MAX)}`}>
                <path
                  className="closed-rent-gauge-track"
                  d="M 30 150 A 120 120 0 0 1 270 150"
                  pathLength={100}
                />
                <path
                  className="closed-rent-gauge-fill"
                  d="M 30 150 A 120 120 0 0 1 270 150"
                  pathLength={100}
                  strokeDasharray={`${metrics.capitalDeployedPercent} 100`}
                />
                <line
                  className="closed-rent-gauge-goal"
                  x1={metrics.capitalGoalInnerPoint.x}
                  y1={metrics.capitalGoalInnerPoint.y}
                  x2={metrics.capitalGoalOuterPoint.x}
                  y2={metrics.capitalGoalOuterPoint.y}
                />
              </svg>
              <div className="closed-rent-gauge-value">{formatMillions(metrics.capitalDeployed)}</div>
              <div className="closed-rent-gauge-scale">
                <span>$0M</span>
                <span>{formatMillions(CAPITAL_DEPLOYED_MAX)}</span>
              </div>
            </div>
          )}
        </section>

        <div className="salesforce-summary-stack">
          <section className="salesforce-summary-card">
            <div className="salesforce-summary-header">GCF Acquired</div>
            {loading ? (
              <div className="salesforce-summary-status">Loading...</div>
            ) : error ? (
              <div className="salesforce-summary-error">Unavailable</div>
            ) : (
              <div className="salesforce-summary-value">{formatMillionsPrecise(metrics.gcfAcquired)}</div>
            )}
          </section>

          <section className="salesforce-summary-card">
            <div className="salesforce-summary-header">Capital Deployed</div>
            {loading ? (
              <div className="salesforce-summary-status">Loading...</div>
            ) : error ? (
              <div className="salesforce-summary-error">Unavailable</div>
            ) : (
              <div className="salesforce-summary-value">{formatMillionsPrecise(metrics.capitalDeployed)}</div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
};

const HomePage: React.FC<HomePageProps> = ({ userInfo }) => {
  console.log('HomePage Render - isAuthenticated:', userInfo.isAuthenticated, 'isEliteGroup:', userInfo.isEliteGroup, 'hasPowerBILicense:', userInfo.hasPowerBILicense);
  const [cards, setCards] = useState<CardContent[]>(() =>
    parseHomepageCardsContent(seedCards)
  );

  const sanitizeBullets = (bullets: string[]) => bullets.filter((l) => l.trim() !== '');

  const localFallbackImage = (index: number) => {
    const bundled = [img2, img11, img3];
    return bundled[index % bundled.length];
  };

  const loadSharePointCards = useCallback(async () => {
    if (!TV_CARDS_API_URL) return;
    const remote = await fetchTvHomepageCardsFromApi(TV_CARDS_API_URL);
    if (!remote) return;
    const parsed = parseHomepageCardsContent(remote)
      .map((card) => ({
        ...card,
        imageUrl: resolveTvMediaUrl(card.imageUrl || '', TV_CARDS_API_URL),
      }))
      .sort((a, b) => a.order - b.order);
    if (parsed.length) setCards(parsed);
  }, []);

  useEffect(() => {
    void loadSharePointCards();
    const id = window.setInterval(() => {
      void loadSharePointCards();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [loadSharePointCards]);

  // Salesforce fetch disabled on this branch (static lobby TV image only)

  return (
    <div className="home-page authenticated home-page-progress">
        <div className="home-page-progress-layout">
          <div className="content-container home-page-progress-container">
            <div className="homepage-cards-section" style={{ order: 2, width: '100%', maxWidth: 'none', margin: '8px auto 0', padding: '4px 16px 0', boxSizing: 'border-box' }}>
              <div className="grid-layout">
                {cards.map((card, index) => {
                  const imageSrc =
                    (card.imageUrl && card.imageUrl.trim()) ||
                    getDefaultFallbackImageDisplaySrc(index) ||
                    localFallbackImage(index);
                  return (
                    <div
                      key={`${card.order}-${card.title}`}
                      className={`card ${index % 2 === 0 ? 'odd-card' : 'even-card'}`}
                    >
                      <SharePointImage
                        src={imageSrc}
                        placeholderSrc={localFallbackImage(index)}
                        alt={card.title}
                        className="card-image"
                      />
                      <div className="card-text">
                        <h2>{card.title}</h2>
                        <ul>
                          {sanitizeBullets(card.bullets).map((bullet, bi) => (
                            <li key={bi} dangerouslySetInnerHTML={{ __html: bullet }} />
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="main-content home-page-progress-main" style={{ order: 1 }}>
              {/* H.O.W. Hero Banner */}
              <section className="homepage-hero" aria-label="Homepage banner">
                <img
                  src={howBanner}
                  alt="Homepage banner"
                  className="homepage-hero-image"
                />
                <div className="homepage-hero-overlay">
                  <h1 className="homepage-hero-title">
                    <span className="homepage-hero-line"><span className="homepage-hero-acronym">H</span><span className="homepage-hero-rest">ighest standards</span></span>
                    <span className="homepage-hero-line"><span className="homepage-hero-acronym">O</span><span className="homepage-hero-rest">ne team</span></span>
                    <span className="homepage-hero-line"><span className="homepage-hero-acronym">W</span><span className="homepage-hero-rest">in!</span></span>
                  </h1>
                </div>
              </section>
            </div>
          </div>
        </div>
    </div>
  );
};

export default HomePage;
