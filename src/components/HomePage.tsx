import React from 'react';
import '../../styles/home-page.css';

import img1 from '../../images/site_1.jpg';
import img2 from '../../images/site_2.jpg';
import img3 from '../../images/site_3.jpg';
import img4 from '../../images/food_drive_2.jpg';
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

  return (
    <div className={`home-page ${isAuthenticated ? 'authenticated' : 'unauthenticated'}`}>
      {isAuthenticated ? (
        <>
          <div className="content-container">
            <div className="grid-layout">
              {/* Card 1 */}
              <div className="card odd-card">
                <img src={img9} alt="Team Accomplishments" className="card-image" />
                <div className="card-text">
                  <h2>Important Dates</h2>
                  <ul>
                    {/* <li>4/22-4/26: Earth Day Clean Up</li>
                    <img src={img8} alt="Earth Day Flyer" style={{ maxWidth: '100%', marginTop: '10px' }} /> */}
                    <li>Thank you to everyone who participated in our Earth Day Clean Up!</li>
                    <li>5/26: Memorial Day</li> 
                    <li>6/11: All Hands Meeting in White Plains, NY</li>
                    <li>6/19: Juneteenth</li>
                    <li>7/4: Independence Day</li>
                  </ul>
                </div>
              </div>
              {/* Card 2 */}
              <div className="card even-card">
                <img src={img2} alt="Conferences & Events" className="card-image" />
                <div className="card-text">
                  <h2>April Performance Highlights</h2>
                  <ul>
                    <li>
                      <strong>Overall Achievement:</strong> We achieved greater than 100% on all April targets, with close to 85% of our annual origination budgeted targets in our line-of-sight. We are poised to have a GREAT YEAR for all of us!
                    </li>
                    <li>
                      <strong>Origination Performance:</strong> Total originated opportunities reached 113, with our internal team outperforming external brokers 51-44 – the first time this year. YTD, we have identified 472 opportunities worth $344M.
                    </li>
                    <li>
                      <strong>LOI Execution:</strong> Delivered 35 executed LOIs in April – one shy of breaking the company record. This was 219% of our monthly goal, achieved without signing multi-location portfolios, showcasing strong origination efforts across our teams.
                    </li>
                    <li>
                      <strong>Deal Closings:</strong> Closed 16 deals worth $13.2M, achieving 145% of budget on quantity and 168% on capital deployment. YTD, we are at 92% of our annual goal for closed deals and 112% ($53M) on capital deployment, with GCF at 105% YTD.
                    </li>
                    <li>
                      <strong>Organic Growth:</strong> Executed $55K of new TCF on easement assets and $31.2K on towers. While below April targets, the pipeline remains steady. YTD, we have signed $343K of new TCF on existing assets.
                    </li>
                    <li>
                      <strong>Integration & Strategic Initiatives:</strong> Progress continues with Site Tracker and NetSuite integrations. We've improved AR through more aggressive handling of delinquent tenants. Additional strategic initiatives are in development.
                    </li>
                    <li>
                      <strong>Community Impact:</strong> Successfully launched our volunteering and community program with strong colleague participation in initial opportunities.
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
              <div className="card even-card">
                <img src={img4} alt="Food Drive" className="card-image" />
                <div className="card-text">
                  <h2>Food Drive</h2>
                  <ul>
                    <li>We provided the largest single donation that Feeding Westchester has ever received!</li>
                    <li>Thank you to everyone who chipped in this Thanksgiving season.</li>
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
                    <li>Please sign up for volunteer opportunities during our Earth Day Clean Up!</li>
                  </ul>
                </div>
              </div>
            </div>

            <aside className="sidebar">
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