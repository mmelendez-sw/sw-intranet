import React from 'react';
import '../../styles/home-page.css';

import img1 from '../../images/site_1.jpg';
import img2 from '../../images/site_2.jpg';
import img3 from '../../images/site_3.jpg';
import img4 from '../../images/run-pic.jpg';
import img5 from '../../images/team.jpg';
import img6 from '../../images/site_4.jpg'
import img7 from '../../images/cityharvest3.png'
import img8 from '../../images/earth_flyer.jpg'
import img9 from '../../images/summer.png'
import img10 from '../../images/cityHarvestMeshProject.png'
import img11 from '../../images/kossak.png'

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
                    {/* <li>6/19: Juneteenth</li> */}
                    {/* <li>7/4: Independence Day</li> */}
                    <li>Celebrating a season of hard work and great teamwork. Here’s to an even brighter fall!</li>
                    <li>10/8: All-Hands Meeting</li> 
                    <li>11/27: Thanksgiving Day</li> 
                    <li>11/28: Day After Thanksgiving</li>
                    <li>12/4: Symphony Holiday Party</li>
                    <li>12/25: Christmas Day</li>
                  </ul>
                </div>
              </div>
              {/* Card 2 */}
              <div className="card even-card">
                <img src={img11} alt="Bowling 2025" className="card-image" />
                <div className="card-text">
                  <h2>2025 Jessica Moebs Memorial Golf Tournament</h2>
                  <ul>
                    <li>
                      Mike Kossak and Steven Lawson attended the 2025 Jessica Moebs Memorial Golf Tournament in North Carolina, supporting a scholarship fund established in Jessica’s memory. The fund helps young women from her hometown in Pulaski, NY, pursue education in STEM and athletics—reflecting Jessica’s passions and lasting impact on the TEP family.
                    </li>
                  </ul>
                </div>
              </div>
              {/* Card 3 */}
              <div className="card odd-card">
                <img src={img7} alt="City Harvest Volunteer Event" className="card-image" />
                <div className="card-text">
                  <h2>City Harvest Volunteer Event</h2>
                  <ul>
                      <li>On August 14th, our volunteers joined City Harvest to help repack large quantities of fresh produce into family-sized portions for distribution across NYC. Much of the food City Harvest receives arrives in bulk containers, which can be hard to distribute equitably. Our team helped take thousands of pounds of apples and pears and repackage them into smaller units that local food programs can easily share with their communities. It was hands-on work with real impact, and we're proud to support an organization doing such essential work for New Yorkers in need. A huge thank you to everyone who participated and represented our team spirit and commitment to giving back!</li>
                      <li>If you have any organizations you would like us to support, please let us know here: <a href="https://www.surveymonkey.com/r/NKSLSRW" target="_blank" rel="noopener noreferrer">https://www.surveymonkey.com/r/NKSLSRW</a>.</li>
                    </ul>
                </div>
              </div>
              {/* Card 4 */}
              <div className="card even-card">
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
              {/* Card 6 */}
              <div className="card even-card">
                <img src={img10} alt="City Harvest Mesh Bag Project" className="card-image" />
                <div className="card-text">
                  <h2>City Harvest Mesh Bag Project</h2>
                  <ul>
                    <li>Thanks to everyone who joined the City Harvest mesh bag project! Together we made over 1,500 bags that will help deliver fresh produce to food pantries across NYC. We’re proud to make a difference—stay tuned for more ways to get involved!</li>
                  </ul>
                </div>
              </div>
            </div>

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