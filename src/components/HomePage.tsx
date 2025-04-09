import React from 'react';
import '../../styles/home-page.css';

import img1 from '../../images/site_1.jpg';
import img2 from '../../images/site_2.jpg';
import img3 from '../../images/site_3.jpg';
import img4 from '../../images/food_drive_2.jpg';
import img5 from '../../images/team.jpg';
import img6 from '../../images/site_4.jpg'
import img7 from '../../images/employee-appreciation.png'

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
                <img src={img1} alt="Team Accomplishments" className="card-image" />
                <div className="card-text">
                  <h2>Important Dates</h2>
                  <ul>
                    <li>4/18: Good Friday</li>
                    <li>4/22-4/26: Earth Day Clean Up</li>
                    <li>5/26: Memorial Day</li> 
                    <li>6/4: All Hands Meeting in White Plains, NY</li>
                    <li>6/19: Juneteenth</li>
                    <li>7/4: Independence Day</li>
                  </ul>
                </div>
              </div>
              {/* Card 2 */}
              <div className="card even-card">
                <img src={img2} alt="Conferences & Events" className="card-image" />
                <div className="card-text">
                  <h2>Company Announcements</h2>
                  <ul>
                    <li><strong>LOI Performance:</strong> February saw 25 LOIs signed (156% of target), committing $13.5M in capital (114% of goal), exceeding budget expectations.</li>
                    <li><strong>Record Closings:</strong> Closed 16 deals (160% of target), deploying $10.8M in capital (150% of goal). February initially projected 19–24 closings.</li>
                    <li><strong>GCF Growth:</strong> Added $472K in February. The smaller deal sizes and two high-multiple deals impacted overall deployed capital.</li>
                    <li><strong>Leasing Success:</strong> Achieved just under $40K in annual cash flow from new leases and collocations. Emphasis needed on improving pipeline deal signings.</li>
                    <li><strong>Broker & Marketing Expansion:</strong> Nearing agreements on new broker partnerships and marketing initiatives for new locations.</li>
                    <li><strong>CTI Integration Progress:</strong> System integration continues smoothly, but IT team is working on improving timelines and finalizing SF workflow. Employees are encouraged to test and provide feedback.</li>
                  </ul>
                </div>
              </div>
              {/* Card 3 */}
              <div className="card odd-card">
                <img src={img7} alt="Team Photo" className="card-image" />
                <div className="card-text">
                  <h2>Symphony Towers Infrastructure Team</h2>
                  <ul>
                    <li>Happy Employee Appreciation Day!</li>
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
                <img src={img3} alt="Marketing Updates" className="card-image" />
                <div className="card-text">
                  <h2>Marketing Updates</h2>
                  <ul>
                    <li>Connect with Justin or Arwa for any marketing email questions</li>
                    <li>Marketing leads will be distributed based on your directors</li>
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