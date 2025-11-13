import React from 'react';
import '../../styles/home-page.css';


import img3 from '../../images/site_3.jpg';
import img4 from '../../images/coat.jpg';
import img7 from '../../images/quiz.jpg'
import img9 from '../../images/award.png'
import img10 from '../../images/alida.jpg'
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
                    <li>11/11-12/3: Toy Store Donation with <a href="https://p2phelps.org/" target="_blank" rel="noopener noreferrer">Person to Person</a></li>
                    <li>11/17: Last Day to Submit <a href="https://www.surveymonkey.com/r/KDR6LSN" target="_blank" rel="noopener noreferrer">Symphony 2025 Value Awards Survey</a></li>
                    <li>11/27: Thanksgiving Day</li> 
                    <li>11/28: Day After Thanksgiving</li>
                    <li>12/4: Symphony Holiday Party</li>
                    <li>12/24: Christmas Eve Early Out at 1:00PM</li>
                    <li>12/25: Christmas Day</li>
                    <li>12/31: New Year's Eve Early Out at 1:00PM</li>
                    <li>1/1: New Year's Day</li>
                    <li>1/19: Martin Luther King Jr. Day</li>
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
                      <a href="https://www.youtube.com/watch?v=AUj_-d7XSPI" target="_blank" rel="noopener noreferrer">Inside Towers Quarterly Briefing</a>
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