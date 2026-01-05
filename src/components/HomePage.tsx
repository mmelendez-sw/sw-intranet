import React, { useRef, useEffect, useState } from 'react';
import '../../styles/home-page.css';
import { UserInfo } from '../types/user';
// import { PowerbiService } from '../services/powerbiService';

import img1 from '../../images/site_1.jpg';
import img3 from '../../images/site_3.jpg';
import img4 from '../../images/coat.jpg';
import img5 from '../../images/team.jpg';
import img6 from '../../images/site_4.jpg';
import img7 from '../../images/quiz.jpg';
import img8 from '../../images/earth_flyer.jpg';
import img9 from '../../images/site_2.jpg';
import img10 from '../../images/alida.jpg';
import img11 from '../../images/santa.jpg';

interface HomePageProps {
  userInfo: UserInfo;
}

const HomePage: React.FC<HomePageProps> = ({ userInfo }) => {
  console.log('HomePage Render - isAuthenticated:', userInfo.isAuthenticated, 'isEliteGroup:', userInfo.isEliteGroup);
  // const powerbiContainerRef = useRef<HTMLDivElement>(null);
  const chartOverlayRef = useRef<HTMLDivElement>(null);
  // const [powerbiConfig, setPowerbiConfig] = useState<any>(null);
  // const [powerbiError, setPowerbiError] = useState<string | null>(null);

  // useEffect(() => {
  //   const container = powerbiContainerRef.current;
  //   if (!container) return;
  //   const preventZoom: EventListener = (e) => {
  //     if ((e instanceof WheelEvent && (e.ctrlKey || e.metaKey)) || e.type.startsWith('gesture')) {
  //       e.preventDefault();
  //     }
  //   };
  //   container.addEventListener('wheel', preventZoom, { passive: false });
  //   container.addEventListener('gesturestart', preventZoom as EventListener, { passive: false });
  //   container.addEventListener('gesturechange', preventZoom as EventListener, { passive: false });
  //   return () => {
  //     container.removeEventListener('wheel', preventZoom);
  //     container.removeEventListener('gesturestart', preventZoom as EventListener);
  //     container.removeEventListener('gesturechange', preventZoom as EventListener);
  //   };
  // }, []);

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

  // Load PowerBI configuration
  // useEffect(() => {
  //   const loadPowerbiConfig = async () => {
  //     try {
  //       const powerbiService = PowerbiService.getInstance();
        
  //       // Validate configuration first
  //       if (!powerbiService.validateConfiguration()) {
  //         setPowerbiError('PowerBI configuration is invalid. Please check POWERBI_SETUP.md');
  //         return;
  //       }

  //       // Generate embed token for the report
  //       const embedToken = await powerbiService.generateEmbedToken('e091da31-91dd-42c2-9b17-099d2e07c492');
  //       setPowerbiConfig(embedToken);
  //       setPowerbiError(null);
  //     } catch (error) {
  //       console.error('Failed to load PowerBI configuration:', error);
  //       setPowerbiError('Failed to load PowerBI report. Please check configuration.');
  //     }
  //   };

  //   if (userInfo.isAuthenticated) {
  //     loadPowerbiConfig();
  //   }
  // }, [userInfo.isAuthenticated]);

  return (
    <div className={`home-page ${userInfo.isAuthenticated ? 'authenticated' : 'unauthenticated'}`}>
      {userInfo.isAuthenticated ? (
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: '6px', width: '100%' }}>
          {/* Main Content White Box */}
          <div className="content-container" style={{ border: 'none', borderRadius: '0', background: 'transparent', boxShadow: 'none', margin: '0 0 0px 10px', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, width: '100%', maxWidth: 'none' }}>
            <div className="main-content" style={{ flex: 1, width: '100%' }}>
              {/* Power BI Report Embed - TEMPORARILY COMMENTED OUT */}
              {/* <div
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
              </div> */}
              
              <div className="grid-layout" style={{ margin: '10px auto 10px auto', width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '0', marginTop: '10px' }}>
                {/* Card 1 */}
                <div className="card odd-card">
                  <img src={img9} alt="Team Accomplishments" className="card-image" />
                  <div className="card-text">
                    <h2>Important Dates</h2>
                    <ul>
                      {/* <li>4/22-4/26: Earth Day Clean Up</li>
                      <img src={img8} alt="Earth Day Flyer" style={{ maxWidth: '100%', marginTop: '10px' }} /> */}
                      {/* <li>6/19: Juneteenth</li> */}
                      {/* <li>12/24: Christmas Eve Early Out at 1:00PM</li>
                      <li>12/25: Christmas Day</li>
                      <li>12/31: New Year's Eve Early Out at 1:00PM</li> */}
                      <li>1/1: New Year's Day</li>
                      <li>1/19: Martin Luther King Jr. Day</li>
                    </ul>
                  </div>
                </div>
                {/* Card 2 */}
                <div className="card even-card">
                  <img src={img11} alt="Bowling 2025" className="card-image" />
                  <div className="card-text">
                    <h2>Happy Holidays from Symphony Towers Infrastructure!</h2>
                    <ul>
                      <li>
                        Thank you to everyone who joined us for the Holiday Party! It was a wonderful opportunity to celebrate the year and look ahead to 2026. The photos are linked below.
                      </li>
                      <li>
                        <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FHoliday%20Party%202025&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd&CT=1765897007566&OR=OWA%2DNT%2DMail&CID=3f303088%2D887e%2D5f5d%2Dc796%2D8c05e6dfe58c&csf=1&web=1&e=KiM4Nf&FolderCTID=0x012000AAC1A88E36691940A87DC692E832396C" target="_blank" rel="noopener noreferrer">Holiday Party 2025</a>
                      </li>
                    </ul>
                  </div>
                </div>
                {/* Card 3 */}
                <div className="card odd-card">
                  <img src={img7} alt="City Harvest Volunteer Event" className="card-image" />
                  <div className="card-text">
                    <h2>Halloween Team Building</h2>
                    <ul>
                      <li>Spooktacular times at our Halloween celebration! Thanks to everyone who joined in the fun and brought their creativity to life.</li>
                    </ul>
                  </div>
                </div> 
                {/* Card 4 */}
                <div className="card even-card">
                  <img src={img4} alt="Food Drive" className="card-image" />
                  <div className="card-text">
                    <h2>Person to Person Coat Drive</h2>
                    <ul>
                      <li>Thank you to our volunteers who joined us for the Person to Person coat drive in Darien, CT! Your kindness keeps our community warm.</li>
                    </ul>
                  </div>
                </div>
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
                        <a href="https://www.youtube.com/watch?v=W3ttrJHdPoM" target="_blank" rel="noopener noreferrer">Inside Towers Quarterly Briefing</a>
                      </li>  
                    </ul>       
                  </div>
                </div> 
                {/* Card 6 */}
                <div className="card even-card">
                  <img src={img10} alt="City Harvest Mesh Bag Project" className="card-image" />
                  <div className="card-text">
                    <h2>InspirASIAN SoCal Topgolf Tournament</h2>
                    <ul>
                      <li>Great day connecting for a cause! Alida Montiel represented at the InspirASIAN SoCal Topgolf Tournament, an event organized with AT&T. This tournament serves as a key gathering for AT&T executives, vendors, and partners committed to supporting Asian & Pacific Islander communities. All proceeds go toward InspirASIAN's scholarship fund for deserving high school students.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Sidebar White Box */}
          <aside className="sidebar sidebar-narrow" style={{ padding: '30px', minWidth: '250px', maxWidth: '280px', boxSizing: 'border-box', background: '#fff', border: 'none', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginLeft: '10px', marginTop: '10px', marginBottom: '10px', display: 'flex', flexDirection: 'column' }}>
              <section className="quick-links" style={{ marginBottom: '20px' }}>
                <button className="home-button" onClick={() => window.open('mailto:Symphony_Tech@symphonywireless.com', '_self')}>Report Technology Issue</button>
              </section>
              <section className="quick-links" style={{ marginBottom: '20px' }}>
                <h2>HR Updates</h2>
                <p>Please take a moment to fill out this survey below to help us better understand your volunteer interests and organization recommendations.</p>
                <button className="home-button" onClick={() => window.open('https://www.surveymonkey.com/r/NKSLSRW', '_self')}>Volunteer Organization Survey</button>
              </section>
              <section className="updates" style={{ marginBottom: '20px' }}>
                <h2>IT Updates</h2>
                <p>Do not click any phishing links</p>
              </section>
              <section className="quick-links" style={{ marginBottom: '20px' }}>
                <h2>Quick Links</h2>
                <button className="home-button" onClick={() => window.open('https://symphonyinfra.my.salesforce.com/', '_blank')}>Salesforce</button>
                <button className="home-button" onClick={() => window.open('https://symphonyinfra.my.salesforce.com/', '_blank')}>SiteTracker</button>
                <button className="home-button" onClick={() => window.open('https://symphonysitesearch.app/', '_blank')}>Synaptek AI Search</button>
                {userInfo.isEliteGroup ? (
                  <button className="home-button" onClick={() => window.open('https://intranet.symphonywireless.com/reports', '_blank')}>Elite Reports</button>
                ) : (
                  <button className="home-button" onClick={() => window.open('https://intranet.symphonywireless.com/reports', '_blank')}>Reports</button>
                )}
                <button className="home-button" onClick={() => window.open('https://identity.trinet.com/', '_blank')}>Trinet</button>
                <button className="home-button" onClick={() => window.open('https://www.concursolutions.com/', '_blank')}>Concur</button>
                <button className="home-button" onClick={() => window.open('https://system.netsuite.com/app/center/card.nl?c=8089687', '_blank')}>Netsuite</button>
                <button className="home-button" onClick={() => window.open('https://outlook.office.com/', '_blank')}>Outlook</button>
              </section>
              <section className="updates" style={{ marginBottom: '20px' }}>
                <h2>Exciting News</h2>
                <p>Palistar Capital combines Symphony Wireless with CTI Towers to form Symphony Towers Infrastructure (Symphony Towers). Read the <a href="https://www.prnewswire.com/news-releases/palistar-capital-announces-combination-of-us-wireless-assets-302350144.html" target="_blank" rel="noopener noreferrer">Press Release</a>.</p> 
              </section>
              <section className="updates" style={{ marginBottom: '20px', flexGrow: 1 }}>
                <h2>2025 Holiday Party Photos</h2>
                <p>Linked below are the photos from our annual Holiday Party! Please browse when you have some time!</p>
                <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FHoliday%20Party%202025&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd&CT=1765897007566&OR=OWA%2DNT%2DMail&CID=3f303088%2D887e%2D5f5d%2Dc796%2D8c05e6dfe58c&csf=1&web=1&e=KiM4Nf&FolderCTID=0x012000AAC1A88E36691940A87DC692E832396C" target="_blank" rel="noopener noreferrer">Holiday Party 2025</a>
              </section>
            </aside>
        </div>
      ) : (
        <div className="unauthenticated-message">
          <h2>Welcome to the Symphony Towers Infrastructure Intranet!</h2>
          <p>Please log in to access more features and content!</p>
        </div>
      )}
      <footer className="footer" style={{ marginTop: '10px' }}>
        <p>&copy; 2025 Symphony Towers Infrastructure. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;