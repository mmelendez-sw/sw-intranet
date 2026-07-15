import React, { useEffect, useState } from 'react';
import '../../styles/home-page.css';


import img3 from '../../images/site_3.jpg';
// import img4 from '../../images/coat.jpg';
// import earthdayImg from '../../images/earthday.png';
import img9 from '../../images/vol.jpg'
// import img10 from '../../images/emp.jpg'
// import img10Md from '../../images/emp_md.jpg'
// import img10Sm from '../../images/emp_sm.jpg'
import img11 from '../../images/wider_app.png'
import stiLogo from '../../images/sti-horizontal-white.png';
// import img11 from '../../images/sip.jpeg'

interface HomePageProps {
  isAuthenticated: boolean;
}

interface SalesforceQueryResponse {
  totalSize: number;
  records: unknown[];
}

const CLOSED_RENT_MAX = 250;
const CLOSED_RENT_GOAL = 104;

const SALESFORCE_CURRENT_INVESTMENTS_URL = (() => {
  const path = '/api/salesforce/current-investments';
  if (typeof window === 'undefined') return path;

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `http://localhost:3001${path}`;
  }

  return path;
})();

const HomePage: React.FC<HomePageProps> = ({ isAuthenticated }) => {
  console.log('HomePage Render - isAuthenticated:', isAuthenticated);
  const [salesforceTotal, setSalesforceTotal] = useState(0);
  const [salesforceLoading, setSalesforceLoading] = useState(false);
  const [salesforceError, setSalesforceError] = useState('');
  const closedRentCount = salesforceTotal;
  const gaugePercent = Math.min(closedRentCount / CLOSED_RENT_MAX, 1) * 100;
  const goalAngle = ((180 - (CLOSED_RENT_GOAL / CLOSED_RENT_MAX) * 180) * Math.PI) / 180;
  const goalInner = {
    x: 110 + 76 * Math.cos(goalAngle),
    y: 110 - 76 * Math.sin(goalAngle),
  };
  const goalOuter = {
    x: 110 + 98 * Math.cos(goalAngle),
    y: 110 - 98 * Math.sin(goalAngle),
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    setSalesforceLoading(true);
    setSalesforceError('');

    fetch(SALESFORCE_CURRENT_INVESTMENTS_URL)
      .then(async (response) => {
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(text || `Salesforce request failed (${response.status})`);
        }
        return response.json() as Promise<SalesforceQueryResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setSalesforceTotal(data.totalSize || 0);
      })
      .catch((err) => {
        if (cancelled) return;
        setSalesforceError(err instanceof Error ? err.message : 'Could not load Salesforce data.');
      })
      .finally(() => {
        if (!cancelled) setSalesforceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <div className={`home-page ${isAuthenticated ? 'authenticated' : 'unauthenticated'}`}>
      {isAuthenticated ? (
        <>
          <div className="content-container">
            <div className="company-progress-header">
              <img src={stiLogo} alt="Symphony Towers" className="company-progress-logo" />
              <h1>Company Progress</h1>
              <div className="company-progress-year">
                <div className="company-progress-year-label">2026</div>
                <div className="company-progress-year-select">2026 (Year)</div>
              </div>
            </div>

            {/* Homepage cards hidden for now. Change false to true to restore. */}
            {false && (
            <div className="grid-layout">
              {/* Card 1 */}
              <div className="card odd-card">
                <img src={img9} alt="Meals on Main Street" className="card-image" style={{ objectFit: 'contain' }} />
                <div className="card-text">
                  <h2>Important Dates</h2>
                    <ul>
                      <li>July - Q2 Performance Reviews</li>
                      <li>7/3: Independence Day Observed</li>
                      <li>9/7: Labor Day</li>
                      <li>11/26: Thanksgiving Day</li>
                      <li>11/27: Day After Thanksgiving</li>
                      <li>12/25: Christmas Day</li>
                    </ul>
                </div>
              </div>
              {/* Card 2 */}
              {/* <div className="card even-card">
                <img src={img11} alt="Bowling 2025" className="card-image" />
                <div className="card-text">
                  <h2>Hidden Talents</h2>
                  <ul>
                    <li>
                      A fun-filled Paint & Sip that brought the team together.  
                    </li>
                  </ul>
                </div>
              </div> */}
              <div className="card even-card">
                <img src={img11} alt="Bowling 2025" className="card-image" />
                <div className="card-text">
                  <h2>New Employee Leads App</h2>
                  <ul>
                    <li>
                      Our goal is to collect 2 leads per month per employee. 
                    </li>
                    <li>
                      This initiative is a part of our company-wide goals for the year. 
                    </li>
                    <li>
                      Please refer to the intranet to learn more about our 2 leads initiative.
                    </li>
                    <li>
                      Please refer to the intranet to learn how to download the app. 
                    </li>
                    <li>
                      Please refer to the intranet to learn how to submit the leads from desktop browser. 
                    </li>
                  </ul>
                </div>
              </div>
              {/* Card 3 — Earth Day (uncomment when ready)
              <div className="card odd-card">
                <img
                  src={earthdayImg}
                  alt="Earth Day"
                  className="card-image"
                  style={{ objectFit: 'contain' }}
                />
                <div className="card-text">
                  <h2>What Can You Do This Earth Day</h2>
                  <ul>
                    <li>Bring a reusable water bottle or coffee mug</li>
                    <li>Take a walk, bike ride, or spend time outdoors</li>
                    <li>Pick up litter during a walk or commute</li>
                    <li>Try a meat-free meal or shop locally for the day.</li>
                    <li>
                      Planting flowers and trees helps clean the air, support pollinators, and create healthier, greener spaces for everyone.
                    </li>
                    <li>If in the office, feel free to grab a packet of flower seeds and grow something meaningful!</li>
                    <li>
                      Show us how you&apos;re celebrating Earth Day this year—share your photos with us at{' '}
                      <a href="mailto:symphonycommunityalliance@symphonyinfra.com">symphonycommunityalliance@symphonyinfra.com</a>.
                    </li>
                  </ul>
                </div>
              </div>
              */}
              {/* Card 4 — Person to Person Coat Drive (uncomment when ready)
              <div className="card even-card">
                <img src={img4} alt="Food Drive" className="card-image" />
                <div className="card-text">
                  <h2>Person to Person Coat Drive</h2>
                  <ul>
                    <li>Thank you to our volunteers who joined us for the Person to Person coat drive in Darien, CT! Your kindness keeps our community warm.</li>
                  </ul>
                </div>
              </div>
              */}
              {/* Card 5 */}
              <div className="card odd-card">
                <img src={img3} alt="Marketing Updates" className="card-image" />
                <div className="card-text">
                  <h2>Marketing Updates</h2>
                  <ul>
                    <li>We're excited to share that our company logo has been updated as part of our ongoing brand refresh.
                      To support this update, we've created a shared folder with updated logo files, templates, and brand collateral for your use. This folder will continue to be updated as additional materials become available.
                      If you have any questions or need assistance, please feel free to reach out to Justin or Arwa.
                      Thank you for helping us maintain a consistent and professional brand presence.</li>
                    <li>
                      <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?csf=1&web=1&e=XUzv8z&ovuser=63fbe43e%2D8963%2D4cb6%2D8f87%2D2ecc3cd029b4&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FMarketing&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd" target="_blank" rel="noopener noreferrer">New Symphony Branding</a>
                    </li>
                    <li>Additionally, linked below are marketing reports from our Inside Towers company subscription and a link to their most recent quarterly briefing.</li>
                    <li>
                      <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?csf=1&web=1&e=XUzv8z&ovuser=63fbe43e%2D8963%2D4cb6%2D8f87%2D2ecc3cd029b4&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FMarketing%2FInside%20Towers%20Market%20Reports&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd" target="_blank" rel="noopener noreferrer">Inside Towers Market Reports</a>
                    </li>
                    <li>
                      <a href="https://www.youtube.com/watch?v=AUj_-d7XSPI" target="_blank" rel="noopener noreferrer">Inside Towers Quarterly Briefing</a>
                    </li>
                  </ul>       
                </div>
              </div>  
              {/* Card 6 — Employee Appreciation Day (uncomment when ready)
              <div className="card even-card">
                <img
                  src={img10}
                  srcSet={`${img10Sm} 480w, ${img10Md} 900w, ${img10} 1200w`}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  alt="Employee Appreciation Day Celebration"
                  className="card-image employee-appreciation-image"
                />
                <div className="card-text">
                  <h2>Employee Appreciation Day Celebration</h2>
                  <ul>
                    <li>Thank you to every team member for your dedication, positive energy, and hard work - your contributions are the reason our Employee Appreciation Day was such a success.</li>
                  </ul>
                </div>
              </div>
              */}
            </div>
            )}

            <section className="salesforce-panel">
              <div className="salesforce-panel-header">
                <h2>Closed Rent (#)</h2>
              </div>
              {salesforceLoading ? (
                <p>Loading Salesforce data...</p>
              ) : salesforceError ? (
                <p className="salesforce-error">{salesforceError}</p>
              ) : (
                <div className="closed-rent-gauge" role="img" aria-label={`Closed Rent count is ${closedRentCount} out of ${CLOSED_RENT_MAX}, goal ${CLOSED_RENT_GOAL}`}>
                  <svg viewBox="0 0 220 130" className="closed-rent-gauge-svg">
                    <path
                      className="closed-rent-gauge-track"
                      d="M 20 110 A 90 90 0 0 1 200 110"
                      pathLength="100"
                    />
                    <path
                      className="closed-rent-gauge-fill"
                      d="M 20 110 A 90 90 0 0 1 200 110"
                      pathLength="100"
                      style={{ strokeDasharray: `${gaugePercent} 100` }}
                    />
                    <line
                      className="closed-rent-gauge-goal"
                      x1={goalInner.x}
                      y1={goalInner.y}
                      x2={goalOuter.x}
                      y2={goalOuter.y}
                    />
                    <text
                      className="closed-rent-gauge-goal-text"
                      x={goalOuter.x - 12}
                      y={goalOuter.y - 8}
                    >
                      {CLOSED_RENT_GOAL}
                    </text>
                  </svg>
                  <div className="closed-rent-gauge-value">{closedRentCount}</div>
                  <div className="closed-rent-gauge-scale">
                    <span>0</span>
                    <span>{CLOSED_RENT_MAX}</span>
                  </div>
                </div>
              )}
            </section>

            <aside className="sidebar">
              <section className="quick-links">
                <button className="home-button" onClick={() => window.open('mailto:Symphony_Tech@symphonywireless.com', '_self')}>Report Technology Issue</button>
              </section>
              <section className="updates">
                <h2>IT Updates</h2>
                <p>Do not click any phishing links</p>
              </section>
              <section className="quick-links">
                <h2>Quick Links</h2>
                <button className="home-button" onClick={() => window.open('https://symphonyinfra.my.salesforce.com/', '_blank')}>Salesforce</button>
                <button className="home-button" onClick={() => window.open('https://symphonyinfra.my.salesforce.com/', '_blank')}>SiteTracker</button>
                <button className="home-button" onClick={() => window.open('https://symphonysitesearch.app/', '_blank')}>Synaptek AI Search</button>
                <button className="home-button" onClick={() => window.open('https://intranet.symphonywireless.com/technology', '_blank')}>Reports</button>
                <button className="home-button" onClick={() => window.open('https://identity.trinet.com/', '_blank')}>Trinet</button>
                <button className="home-button" onClick={() => window.open('https://www.concursolutions.com/', '_blank')}>Concur</button>
                <button className="home-button" onClick={() => window.open('https://system.netsuite.com/app/center/card.nl?c=8089687', '_blank')}>Netsuite</button>
                <button className="home-button" onClick={() => window.open('https://outlook.office.com/', '_blank')}>Outlook</button>
              </section>
              <section className="updates">
                <h2>Exciting News</h2>
                <p>Palistar Capital combines Symphony Wireless with CTI Towers to form Symphony Towers Infrastructure (Symphony Towers). Read the <a href="https://www.prnewswire.com/news-releases/palistar-capital-announces-combination-of-us-wireless-assets-302350144.html" target="_blank" rel="noopener noreferrer">Press Release</a>.</p> 
              </section>
              <section className="updates">
                <h2>2025 Holiday Party Photos</h2>
                <p>Linked below are the photos from our annual Holiday Party! Please browse when you have some time!</p>
                <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FHoliday%20Party%202025&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd&CT=1765897007566&OR=OWA%2DNT%2DMail&CID=3f303088%2D887e%2D5f5d%2Dc796%2D8c05e6dfe58c&csf=1&web=1&e=KiM4Nf&FolderCTID=0x012000AAC1A88E36691940A87DC692E832396C" target="_blank" rel="noopener noreferrer">Holiday Party 2025</a>
              </section>
            </aside>
          </div>
        </>
      ) : (
        <div className="unauthenticated-message">
          <h2>Welcome to the Symphony Towers Infrastructure Intranet!</h2>
          <p>Please log in to access more features and content.</p>
        </div>
      )}
      <footer className="footer">
        <p>&copy; 2025 Symphony Towers Infrastructure. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;
