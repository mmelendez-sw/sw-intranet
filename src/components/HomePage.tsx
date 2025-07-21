import React, { useEffect, useRef } from 'react';
import '../../styles/home-page.css';

import img1 from '../../images/site_1.jpg';
import img2 from '../../images/site_2.jpg';
import img3 from '../../images/site_3.jpg';
import img4 from '../../images/run-pic.jpg';
import img5 from '../../images/team.jpg';
import img6 from '../../images/site_4.jpg'
import img7 from '../../images/employee-appreciation.png'
import img8 from '../../images/earth_flyer.jpg'
import img9 from '../../images/earth-pic.png'

interface HomePageProps {
  isAuthenticated: boolean;
}

const HomePage: React.FC<HomePageProps> = ({ isAuthenticated }) => {
  console.log('HomePage Render - isAuthenticated:', isAuthenticated);
  const powerbiContainerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className={`home-page ${isAuthenticated ? 'authenticated' : 'unauthenticated'}`}>
      {isAuthenticated ? (
        <>
          <div className="content-container" style={{ border: '1px solid #e0e0e0', borderRadius: '10px', background: '#fafbfc', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', margin: '40px auto', maxWidth: '1800px', display: 'grid', gridTemplateColumns: '1fr 540px', gap: '32px', alignItems: 'start' }}>
            <div className="main-content" style={{ flex: 1 }}>
              {/* Power BI Report Embed */}
              <div
                className="powerbi-embed-container"
                ref={powerbiContainerRef}
                style={{ width: '1000px', margin: '0 auto 32px auto', padding: '16px 0', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'center' }}
              >
                <iframe
                  title="Company Progress"
                  width="1000"
                  height="550"
                  src="https://app.powerbi.com/reportEmbed?reportId=e091da31-91dd-42c2-9b17-099d2e07c492&autoAuth=true&ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&filterPaneEnabled=false&navContentPaneEnabled=false"
                  frameBorder="0"
                  allowFullScreen={false}
                  style={{ border: 'none', borderRadius: '8px', background: '#fff', display: 'block', resize: 'none', overflow: 'hidden' }}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                ></iframe>
              </div>
              <div className="grid-layout">
                {/* Card 1 */}
                <div className="card odd-card">
                  <img src={img9} alt="Team Accomplishments" className="card-image" />
                  <div className="card-text">
                    <h2>Important Dates</h2>
                    <ul>
                      {/* <li>4/22-4/26: Earth Day Clean Up</li>
                      <img src={img8} alt="Earth Day Flyer" style={{ maxWidth: '100%', marginTop: '10px' }} /> */}
                      <li>6/19: Juneteenth</li>
                      <li>7/4: Independence Day</li>
                    </ul>
                  </div>
                </div>
                {/* Card 2 */}
                <div className="card even-card">
                  <img src={img2} alt="Conferences & Events" className="card-image" />
                  <div className="card-text">
                    <h2>May Performance Highlights</h2>
                    <ul>
                      <li>
                        <strong>Overall Achievement:</strong> May was our 2nd best month of the year with 34 executed LOIs – 121% of our goal. Huge thanks to everyone for your continued efforts and focus!
                      </li>
                      <li>
                        <strong>Origination Performance:</strong> We originated 101 opportunities, slightly under target. Andy and the team are working hard to boost this metric quickly.
                      </li>
                      <li>
                        <strong>LOI Execution:</strong> We signed 34 LOIs in May, continuing a strong trend and showing solid momentum. We're heading into the summer months with excellent traction.
                      </li>
                      <li>
                        <strong>Deal Closings:</strong> We closed 20 deals vs. a goal of 19, putting us at 96% of our annual closed deal goal and over 105% of our capital targets. Tremendous cross-functional teamwork!
                      </li>
                      <li>
                        <strong>Budget Metrics:</strong> May performance stood at: CRs – 105%, GCF – 104%, and TS – ~120% of budget. Year-to-date: CRs – 95% (#) and 110% ($), GCF – 104%, TS – 124%+.
                      </li>
                      <li>
                        <strong>Channel Performance:</strong> External brokers still drive 50% of performance. BD/M&A team hit 100% of their May targets – great leadership by Issac. Internal origination continues improving at 72% (CR #) and 80% (CR $).
                      </li>
                      <li>
                        <strong>Looking Ahead:</strong> As summer approaches, let’s keep the momentum going. We're well positioned but need to push hard across all fronts to reach our full potential.
                      </li>
                    </ul>
                  </div>
                </div>
                {/* Card 3 */}
                <div className="card even-card">
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
                      <li>Check out Bernard's panel discussion on AI Powered Solutions for Wireless Construction and Deployment at the 2025 South Wireless Summit!</li>
                      <li>
                        <a href="https://symphonytowersinfrastructure.com/recent-press/ai-powered-solutions-for-wireless-construction-and-deployment/" target="_blank" rel="noopener noreferrer">South Wireless Summit Panel Discussion</a>
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
                {/* Card 4 */}
                <div className="card odd-card">
                  <img src={img4} alt="Food Drive" className="card-image" />
                  <div className="card-text">
                    <h2>JP Morgan Corporate Challenge</h2>
                    <ul>
                      <li>Thank you to all our employees who participated in the J.P. Morgan Race—your energy and enthusiasm helped support the Central Park Conservancy and made a meaningful impact!</li>
                    </ul>
                  </div>
                </div>
                {/* Card 5 */}
                <div className="card odd-card">
                  <img src={img7} alt="Team Photo" className="card-image" />
                  <div className="card-text">
                    <h2>Symphony Towers Infrastructure Team</h2>
                    <ul>
                      <li>Happy Employee Appreciation Day!</li>
                    </ul>
                  </div>
                </div>
                {/* Card 6 */}
                <div className="card even-card">
                  <img src={img6} alt="Food Drive" className="card-image" />
                  <div className="card-text">
                    <h2>Other Updates</h2>
                    <ul>
                      <li>Say hello to the summer interns!</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <aside className="sidebar sidebar-narrow" style={{ padding: '16px', minWidth: '500px', maxWidth: '600px', boxSizing: 'border-box', background: '#fff', borderLeft: '2px solid #e0e0e0', borderRight: '2px solid #e0e0e0', marginLeft: '0', marginTop: '24px', boxShadow: '2px 0 12px 0 rgba(0,0,0,0.07)' }}>
              <section className="quick-links">
                <button className="home-button" onClick={() => window.open('mailto:Symphony_Tech@symphonywireless.com', '_self')}>Report Technology Issue</button>
              </section>
              <section className="quick-links">
                <h2>HR Updates</h2>
                <p>Please take a moment to fill out this survey below to help us better understand your volunteer interests and organization recommendations.</p>
                <button className="home-button" onClick={() => window.open('https://www.surveymonkey.com/r/NKSLSRW', '_self')}>Volunteer Organization Survey</button>
              </section>
              <section className="updates">
                <h2>IT Updates</h2>
                <p>Do not click any phishing links</p>
              </section>
              <section className="quick-links">
                <h2>Quick Links</h2>
                <button className="home-button" onClick={() => window.open('https://symphonyinfra.my.salesforce.com/', '_blank')}>Salesforce</button>
                <button className="home-button" onClick={() => window.open('https://sitetracker-symphonyinfra.my.salesforce.com/?ec=302&startURL=%2Fvisualforce%2Fsession%3Furl%3Dhttps%253A%252F%252Fsitetracker-symphonywireless.lightning.force.com%252Flightning%252Fpage%252Fhome', '_blank')}>SiteTracker</button>
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
                <h2>Holiday Party Photos</h2>
                <p>Linked below are the photos from our annual Holiday Party! Please browse when you have some time!</p>
                <a href="https://symphonywireless.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?FolderCTID=0x012000AAC1A88E36691940A87DC692E832396C&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FHoliday%20Party%202024" target="_blank" rel="noopener noreferrer">Holiday Party 2024</a>
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