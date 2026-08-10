import React, { useEffect, useRef, useState } from 'react';
import { service, factories, models } from 'powerbi-client';
import '../../styles/company-progress.css';
import { UserInfo } from '../types/user';
import { SALESFORCE_CURRENT_INVESTMENTS_URL } from '../authConfig';
import { PowerbiService, PowerbiEmbedToken } from '../services/powerbiService';

const powerbiEmbedService = new service.Service(
  factories.hpmFactory,
  factories.wpmpFactory,
  factories.routerFactory
);

interface SalesforceInvestmentRecord {
  Id: string;
  All_In_Purchase_Price__c?: number | null;
  Annual_Rent__c?: number | null;
  Source_Type__c?: string | null;
}

interface SalesforceInvestmentResponse {
  records?: SalesforceInvestmentRecord[];
}

const CLOSED_RENT_MAX = 250;
const CLOSED_RENT_GOAL = 104;
const CAPITAL_DEPLOYED_MAX = 210_000_000;
const CAPITAL_DEPLOYED_GOAL = 82_000_000;

const getGaugePoint = (value: number, max: number, radius: number) => {
  const centerX = 150;
  const centerY = 150;
  const ratio = Math.max(0, Math.min(value / max, 1));
  const angle = Math.PI - ratio * Math.PI;
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
  const gcfAcquired = rows.reduce((total, row) => total + toNumber(row.Annual_Rent__c), 0);

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
              <svg
                className="closed-rent-gauge-svg"
                viewBox="0 -28 300 218"
                role="img"
                aria-label={`Closed Rent count ${metrics.closedRentCount} out of ${CLOSED_RENT_MAX}`}
              >
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
              <div className="salesforce-panel-goal">
                Goal : {formatMillions(metrics.capitalDeployedGoal)}
              </div>
              <svg
                className="closed-rent-gauge-svg"
                viewBox="0 -28 300 218"
                role="img"
                aria-label={`Capital Deployed ${formatMillions(metrics.capitalDeployed)} out of ${formatMillions(CAPITAL_DEPLOYED_MAX)}`}
              >
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
              <div className="salesforce-summary-value">
                {formatMillionsPrecise(metrics.gcfAcquired)}
              </div>
            )}
          </section>

          <section className="salesforce-summary-card">
            <div className="salesforce-summary-header">Capital Deployed</div>
            {loading ? (
              <div className="salesforce-summary-status">Loading...</div>
            ) : error ? (
              <div className="salesforce-summary-error">Unavailable</div>
            ) : (
              <div className="salesforce-summary-value">
                {formatMillionsPrecise(metrics.capitalDeployed)}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
};

interface CompanyProgressProps {
  userInfo: UserInfo;
  /** Show Salesforce gauge panels (default true). */
  showGauges?: boolean;
  /** Show Power BI embed (default true when authenticated). */
  showPowerBi?: boolean;
}

/**
 * Company Progress: Power BI embed (Lambda ROPC auto-sign-in) + Salesforce gauges.
 */
const CompanyProgress: React.FC<CompanyProgressProps> = ({
  userInfo,
  showGauges = true,
  showPowerBi = true,
}) => {
  const powerbiContainerRef = useRef<HTMLDivElement>(null);
  const [embedConfig, setEmbedConfig] = useState<PowerbiEmbedToken | null>(null);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [salesforceRows, setSalesforceRows] = useState<SalesforceInvestmentRecord[]>([]);
  const [salesforceLoading, setSalesforceLoading] = useState(true);
  const [salesforceError, setSalesforceError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    if (!showPowerBi || !userInfo.isAuthenticated) return;

    const loadEmbed = async () => {
      try {
        setEmbedError(null);
        const config = await PowerbiService.getInstance().generateEmbedToken();
        if (isActive) setEmbedConfig(config);
      } catch (error) {
        console.error('Failed to load Power BI embed config:', error);
        if (isActive) {
          setEmbedError(error instanceof Error ? error.message : 'Failed to load Power BI report.');
          setEmbedConfig(null);
        }
      }
    };

    loadEmbed();
    return () => {
      isActive = false;
    };
  }, [showPowerBi, userInfo.isAuthenticated]);

  useEffect(() => {
    const container = powerbiContainerRef.current;
    if (!container || !embedConfig) return;

    powerbiEmbedService.embed(container, {
      type: 'report',
      id: embedConfig.reportId,
      embedUrl: embedConfig.embedUrl,
      accessToken: embedConfig.token,
      tokenType:
        embedConfig.tokenType === 'Aad' ? models.TokenType.Aad : models.TokenType.Embed,
      settings: {
        filterPaneEnabled: false,
        navContentPaneEnabled: false,
        background: models.BackgroundType.Transparent,
      },
    });

    return () => {
      powerbiEmbedService.reset(container);
    };
  }, [embedConfig]);

  useEffect(() => {
    let isActive = true;
    if (!showGauges) return;

    const loadSalesforceRows = async () => {
      try {
        setSalesforceLoading(true);
        setSalesforceError(null);

        const response = await fetch(SALESFORCE_CURRENT_INVESTMENTS_URL);
        const data = (await response.json().catch(() => ({}))) as SalesforceInvestmentResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || `Salesforce request failed (${response.status})`);
        }

        if (isActive) {
          setSalesforceRows(data.records || []);
        }
      } catch (error) {
        console.error('Failed to load Salesforce investments:', error);
        if (isActive) {
          setSalesforceError(
            error instanceof Error ? error.message : 'Failed to load Salesforce data.'
          );
          setSalesforceRows([]);
        }
      } finally {
        if (isActive) setSalesforceLoading(false);
      }
    };

    loadSalesforceRows();
    return () => {
      isActive = false;
    };
  }, [showGauges]);

  const proprietaryRows = salesforceRows.filter(
    (row) => (row.Source_Type__c || '').trim().toLowerCase() === 'proprietary'
  );

  return (
    <div className="company-progress-section">
      {showPowerBi && (
        <>
          {userInfo.isAuthenticated ? (
            <div
              className="powerbi-embed-container"
              style={{
                width: '100%',
                maxWidth: '1400px',
                height: '425px',
                margin: '0 auto 28px',
                padding: 0,
                background: '#fff',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                alignItems: 'center',
              }}
            >
              {embedConfig ? (
                <div
                  ref={powerbiContainerRef}
                  style={{
                    width: '100%',
                    height: '425px',
                    border: 'none',
                    borderRadius: '8px',
                    background: '#fff',
                  }}
                />
              ) : (
                <div style={{ color: '#666', padding: 20, textAlign: 'center' }}>
                  {embedError || 'Loading Power BI report...'}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                maxWidth: '1400px',
                height: '120px',
                margin: '0 auto 28px',
                padding: '20px',
                background: '#fff',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <div>
                <h3>Power BI Report</h3>
                <p>Sign in to view the Company Progress report.</p>
              </div>
            </div>
          )}
        </>
      )}

      {showGauges && (
        <>
          <ProgressSection
            title="Company Progress"
            rows={salesforceRows}
            loading={salesforceLoading}
            error={salesforceError}
            closedRentGoal={241}
            capitalDeployedGoal={175_000_000}
            featured
          />
          <ProgressSection
            title="Acquisition Team Progress"
            rows={proprietaryRows}
            loading={salesforceLoading}
            error={salesforceError}
            closedRentGoal={111}
            capitalDeployedGoal={82_000_000}
          />
        </>
      )}
    </div>
  );
};

export default CompanyProgress;
