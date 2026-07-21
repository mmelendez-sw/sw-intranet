import React, { useRef, useEffect, useState } from 'react';
import '../../styles/home-page.css';
import { UserInfo } from '../types/user';
import { PowerbiService } from '../services/powerbiService';
import img2 from '../../images/site_2.jpg';
import img3 from '../../images/site_3.jpg';
import img11 from '../../images/wider_app.png';

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
  const powerbiContainerRef = useRef<HTMLDivElement>(null);
  const chartOverlayRef = useRef<HTMLDivElement>(null);
  const [powerbiConfig, setPowerbiConfig] = useState<any>(null);
  const [powerbiError, setPowerbiError] = useState<string | null>(null);
  const [salesforceRows, setSalesforceRows] = useState<SalesforceInvestmentRecord[]>([]);
  const [salesforceLoading, setSalesforceLoading] = useState(true);
  const [salesforceError, setSalesforceError] = useState<string | null>(null);

  useEffect(() => {
    const container = powerbiContainerRef.current;
    if (!container) return;
    const preventZoom: EventListener = (e) => {
      if ((e instanceof WheelEvent && (e.ctrlKey || e.metaKey)) || e.type.startsWith('gesture')) {
        e.preventDefault();
      }
    };
    container.addEventListener('wheel', preventZoom, { passive: false });
    container.addEventListener('gesturestart', preventZoom as EventListener, { passive: false });
    container.addEventListener('gesturechange', preventZoom as EventListener, { passive: false });
    return () => {
      container.removeEventListener('wheel', preventZoom);
      container.removeEventListener('gesturestart', preventZoom as EventListener);
      container.removeEventListener('gesturechange', preventZoom as EventListener);
    };
  }, []);

  useEffect(() => {
    const overlay = chartOverlayRef.current;
    if (!overlay) return;
    const preventZoom = (e: WheelEvent | TouchEvent | MouseEvent) => {
      if ((e instanceof WheelEvent && (e.ctrlKey || e.metaKey)) || e.type.startsWith('gesture')) {
        e.preventDefault();
      }
    };
    overlay.addEventListener('wheel', preventZoom, { passive: false });
    overlay.addEventListener('gesturestart', preventZoom as EventListener, { passive: false });
    overlay.addEventListener('gesturechange', preventZoom as EventListener, { passive: false });
    return () => {
      overlay.removeEventListener('wheel', preventZoom);
      overlay.removeEventListener('gesturestart', preventZoom as EventListener);
      overlay.removeEventListener('gesturechange', preventZoom as EventListener);
    };
  }, []);

  // Load PowerBI configuration - Only if user has Power BI license
  useEffect(() => {
    const loadPowerbiConfig = async () => {
      try {
        const powerbiService = PowerbiService.getInstance();
        
        // Validate configuration first
        if (!powerbiService.validateConfiguration()) {
          setPowerbiError('PowerBI configuration is invalid. Please check POWERBI_SETUP.md');
          return;
        }

        // Generate embed token for the report
        const embedToken = await powerbiService.generateEmbedToken('e091da31-91dd-42c2-9b17-099d2e07c492');
        setPowerbiConfig(embedToken);
        setPowerbiError(null);
      } catch (error) {
        console.error('Failed to load PowerBI configuration:', error);
        setPowerbiError('Failed to load PowerBI report. Please check configuration.');
      }
    };

    if (userInfo.isAuthenticated && userInfo.hasPowerBILicense) {
      loadPowerbiConfig();
    }
  }, [userInfo.isAuthenticated, userInfo.hasPowerBILicense]);

  useEffect(() => {
    let isActive = true;

    const loadSalesforceRows = async () => {
      try {
        setSalesforceLoading(true);
        setSalesforceError(null);

        const response = await fetch(SALESFORCE_CURRENT_INVESTMENTS_URL);
        const data: SalesforceInvestmentResponse & { error?: string } = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Salesforce request failed (${response.status})`);
        }

        if (isActive) {
          setSalesforceRows(data.records || []);
        }
      } catch (error) {
        console.error('Failed to load Salesforce investments:', error);
        if (isActive) {
          setSalesforceError(error instanceof Error ? error.message : 'Failed to load Salesforce data.');
          setSalesforceRows([]);
        }
      } finally {
        if (isActive) {
          setSalesforceLoading(false);
        }
      }
    };

    loadSalesforceRows();

    return () => {
      isActive = false;
    };
  }, []);

  const proprietaryRows = salesforceRows.filter(
    (row) => (row.Source_Type__c || '').trim().toLowerCase() === 'proprietary'
  );

  return (
    <div className="home-page authenticated home-page-progress">
        <div className="home-page-progress-layout">
          <div className="content-container home-page-progress-container">
            <div className="homepage-cards-section" style={{ order: 2, width: '100%', maxWidth: 'none', margin: '8px auto 0', padding: '4px 16px 0', boxSizing: 'border-box' }}>
              <div className="grid-layout">
                {/* Card 1 */}
                <div className="card odd-card">
                  <img src={img2} alt="Important Dates" className="card-image" />
                  <div className="card-text">
                    <h2>Important Dates</h2>
                    <ul>
                      <li>July - Q2 Performance Reviews</li>
                      <li>9/7: Labor Day</li>
                      <li>11/26: Thanksgiving Day</li>
                      <li>11/27: Day After Thanksgiving</li>
                      <li>12/25: Christmas Day </li>
                    </ul>
                  </div>
                </div>
                {/* Card 2 */}
                <div className="card even-card">
                  <img src={img11} alt="Bowling 2025" className="card-image" />
                  <div className="card-text">
                    <h2>New Employee Leads App</h2>
                    <ul>
                      <li>Our goal is to collect 2 leads per month per employee.</li>
                      <li>This initiative is a part of our company-wide goals for the year.</li>
                      <li>
                        <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/_layouts/15/stream.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared+Documents%2FMarketing%2FMobile+Application%2FSymphony+Towers+Employee+Leads+App+Promo.mp4&startedResponseCatch=true&referrer=StreamWebApp.Web&referrerScenario=AddressBarCopied.view.6ed79924-e884-4365-b062-18e93c0a0912" target="_blank" rel="noopener noreferrer">CLICK HERE</a> to learn more about our 2 leads initiative.
                      </li>
                      <li>
                        <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/_layouts/15/stream.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FMarketing%2FMobile%20Application%2FEmployee%20Leads%20App%20%2D%20Download%20Instructional%20Demo%20Video%2Emp4&referrer=StreamWebApp%2EWeb&referrerScenario=AddressBarCopied%2Eview%2Eb252ef14%2Dee35%2D474b%2D8a55%2D7418b4c2f0c0" target="_blank" rel="noopener noreferrer">CLICK HERE</a> to learn how to download the app.
                      </li>
                      <li>
                        <a href="https://symphonyinfrastructure.sharepoint.com/:w:/r/sites/SymphonyWirelessTeam/Shared%20Documents/Marketing/Mobile%20Application/Lead%20Generation%20on%20Desktop.docx?d=w8c75eaf79afe4fbd80c32c0f5b2ada4f&csf=1&web=1&e=0mifAu" target="_blank" rel="noopener noreferrer">CLICK HERE</a> to learn how to submit the leads from desktop browser.
                      </li>
                    </ul>
                  </div>
                </div>
                {/* Card 3 */}
                <div className="card odd-card">
                  <img src={img3} alt="Marketing Updates" className="card-image" />
                  <div className="card-text">
                    <h2>Marketing Updates</h2>
                    <ul>
                      <li>Please reference our shared company folder for branded collateral. This folder will continue to be updated as additional materials become available. If you have any questions or need assistance, please feel free to reach out to the marketing team. Thank you for helping us maintain a consistent and professional brand presence. </li>
                      <li>
                        <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?csf=1&web=1&e=XUzv8z&ovuser=63fbe43e%2D8963%2D4cb6%2D8f87%2D2ecc3cd029b4&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FMarketing&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd" target="_blank" rel="noopener noreferrer">Symphony Branded Assets</a>
                      </li>
                      <li>Additionally, linked below are marketing reports from our Inside Towers company subscription and a link to their most recent quarterly briefing.</li>
                      <li>
                        <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?csf=1&web=1&e=XUzv8z&ovuser=63fbe43e%2D8963%2D4cb6%2D8f87%2D2ecc3cd029b4&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FMarketing%2FInside%20Towers%20Market%20Reports&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd" target="_blank" rel="noopener noreferrer">Inside Towers Market Reports</a>
                      </li>
                      <li>
                        <a href="https://www.youtube.com/watch?v=Mpg0MAu7JNQ" target="_blank" rel="noopener noreferrer">Inside Towers Quarterly Briefing</a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="main-content home-page-progress-main" style={{ order: 1 }}>
              
              {/* Power BI Report Embed - temporarily disabled
              {userInfo.hasPowerBILicense ? (
                <div
                  ref={powerbiContainerRef}
                  className="powerbi-embed-container"
                  style={{ width: '100%', height: '425px', margin: '-42px 0 0 0', padding: 0, background: '#fff', border: 'none', borderBottom: 'none', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'center', position: 'relative', overflow: 'hidden', alignItems: 'center', top: 0 }}
                >
                  {powerbiError ? (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      height: '100%', 
                      color: '#d32f2f',
                      textAlign: 'center',
                      padding: '20px'
                    }}>
                      <div>
                        <h3>⚠️ PowerBI Configuration Error</h3>
                        <p>{powerbiError}</p>
                        <p style={{ fontSize: '0.9em', marginTop: '10px' }}>
                          Please follow the setup guide in <strong>POWERBI_SETUP.md</strong>
                        </p>
                      </div>
                    </div>
                  ) : powerbiConfig ? (
                    <iframe
                      title="Company Progress"
                      width="100%"
                      height="425"
                      src={powerbiConfig.token ? `${powerbiConfig.embedUrl}&embedToken=${powerbiConfig.token}` : powerbiConfig.embedUrl}
                      frameBorder="0"
                      allowFullScreen={false}
                      style={{ border: 'none', borderRadius: '8px', background: '#fff', display: 'block', transform: 'scale(1.9) translate(-0.25%, 1%)', transformOrigin: 'center center' }}
                      sandbox="allow-scripts allow-same-origin allow-popups"
                    />
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      height: '100%', 
                      color: '#666'
                    }}>
                      <div>Loading PowerBI report...</div>
                    </div>
                  )}
                  <div ref={chartOverlayRef} style={{ position: 'absolute', top: '220px', left: 0, width: '100%', height: '205px', zIndex: 2, background: 'transparent', pointerEvents: 'none' }}></div>
                </div>
              ) : (
                <div
                  style={{ 
                    width: '100%', 
                    height: '425px', 
                    margin: '-42px 0 0 0', 
                    padding: '20px', 
                    background: '#fff', 
                    border: 'none', 
                    borderRadius: '10px', 
                    boxShadow: '0 2px 8px rgba(0,0,0,0.07)', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    textAlign: 'center'
                  }}
                >
                  <div>
                    <h3>📊 Power BI Report</h3>
                    <p>This report requires a Power BI license to view.</p>
                    <p style={{ fontSize: '0.9em', color: '#666', marginTop: '10px' }}>
                      Contact your administrator to request Power BI access.
                    </p>
                  </div>
                </div>
              )}
              */}
              <ProgressSection
                title="Company Progress"
                rows={salesforceRows}
                loading={salesforceLoading}
                error={salesforceError}
                closedRentGoal={241}
                capitalDeployedGoal={175_000_000}
                featured
              />
              {/* Acquisition Team Progress - temporarily disabled
              <ProgressSection
                title="Acquisition Team Progress"
                rows={proprietaryRows}
                loading={salesforceLoading}
                error={salesforceError}
                closedRentGoal={111}
                capitalDeployedGoal={72_000_000}
              />
              */}
            </div>
          </div>
        </div>
    </div>
  );
};

export default HomePage;