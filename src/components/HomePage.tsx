import React from 'react';
import Header from '../components/Header';
import '../../styles/home-page.css';

import img1 from '../../images/site_1.jpg';
import img2 from '../../images/site_2.jpg';
import img3 from '../../images/site_3.jpg';
import img4 from '../../images/food_drive_2.jpg';
import img5 from '../../images/team.jpg';
import img6 from '../../images/site_4.jpg'
import img7 from '../../images/site_5.jpg'

interface HomePageProps {
  isAuthenticated: boolean;
}

const HomePage: React.FC<HomePageProps> = ({ isAuthenticated }) => {
  console.log('HomePage Render - isAuthenticated:', isAuthenticated);

  return (
    <div className={`home-page ${isAuthenticated ? 'authenticated' : 'unauthenticated'}`}>
      <Header />
      {isAuthenticated ? (
        <>
          <div className="content-container">
            {/* Main content grid */}
            <div className="text-bar top-bar">
              <h2>Message from IT</h2>
              <p>Exciting news! A new Salesforce instance will be launched on January 6th, 2025, bringing a seamless, continuous workflow across all departments!</p>
              <p>Please ensure your teams are familiar with the new functionalities in preparation.</p>
            </div>
            <div className="grid-layout">
              {/* Card 1 */}
              <div className="card odd-card">
                <img src={img1} alt="Team Accomplishments" className="card-image" />
                <div className="card-text">
                  <h2>Company Announcements</h2>
                  <ul>
                      <li><strong>November Milestone Achieved!</strong> First time Symphony hit its CR quantity number (16 deals closed) and surpassed the CR capital deployment budget, deploying $14M vs. budgeted $11.5M.</li>
                      <li><strong>Strong LOI Performance:</strong> Signed 27 LOIs (vs. budgeted 26), representing $16.2M of committed capital.</li>
                      <li><strong>Annual GCF Breakthrough:</strong> Surpassed $20M annual GCF, now at $20.6M, with contracted GCF growing to $25.3M. Aiming to close signed LOIs and reach $25M soon.</li>
                      <li><strong>Asset Management Progress:</strong> Signed 21 revenue-generating leases YTD, contributing $307K in annual GCF, with more in progress.</li>
                      <li><strong>Capital Deployment Momentum:</strong> Deployed $93.7M YTD; targeting over $100M by year-end for the first time ever—focus on early closures in December.</li>
                      <li><strong>Q1 Pipeline Development:</strong> Driving origination efforts and leveraging team momentum to build a strong pipeline for the next quarter.</li>
                  </ul>
                </div>
              </div>
              {/* Card 2 */}
              <div className="card even-card">
                <img src={img2} alt="Conferences & Events" className="card-image" />
                <div className="card-text">
                  <h2>Conferences & Events</h2>
                  <ul>
                    {/* <li>11/18: Nareit's REITworld: 2024 Annual Conference</li>
                    <li>11/20: New Jersey Wireless Association Holiday Social</li> */}
                    {/* <li>12/4: California Wireless Association SoCal Holiday Party</li> */}
                    <li>12/11-12/12: ICSC New York</li>
                    <li>12/13: Florida Wireless Association Charity Golf Tournament</li>
                  </ul>
                </div>
              </div>
              {/* Card 3 */}
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
              {/* Text Bar for Other Key Updates */}
              <div className="text-bar">
                  <h2>Key Updates</h2>
              </div>
              {/* Card 4 */}
              <div className="card even-card">
                <img src={img4} alt="Food Drive" className="card-image" />
                <div className="card-text">
                  <h2>Food Drive</h2>
                  <ul>
                    <li>We provided the largest single donation that Feeding Westchest have ever received!</li>
                    <li>Thank you to everyone who chipped in this Thanksgiving season.</li>
                  </ul>
                </div>
                
              </div>
              {/* Card 5 */}
              <div className="card odd-card">
                <img src={img5} alt="Team Photo" className="card-image" />
                <div className="card-text">
                  <h2>Symphony Wireless Team</h2>
                  <ul>
                    <li>Meet the team that makes everything possible.</li>
                  </ul>
                </div>
              </div>
              {/* Card 6 */}
              <div className="card even-card">
                <img src={img6} alt="Food Drive" className="card-image" />
                <div className="card-text">
                  <h2>Other Updates</h2>
                  <ul>
                    {/* <li>RSVP for Symphony Holiday Party on December 5th</li> */}
                    <li>Bagel Breakfast is December 12th!</li>
                    {/* <li>Enjoy your Thanksgiving break!</li> */}
                  </ul>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="sidebar">
              <section className="updates">
                <h2>Holiday Party Photos</h2>
                {/* <p className='imp-p'>Microsoft is experiencing outages on Teams and Outlook. We will update once the issues are resolved.</p> */}
                <p>Linked below are the photos from our annual Holiday Party! Please browse when you have some time!</p>
                <a href="https://symphonywireless.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?FolderCTID=0x012000AAC1A88E36691940A87DC692E832396C&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FHoliday%20Party%202024" target="_blank" rel="noopener noreferrer">Holiday Party 2024</a>
              </section>
              <section className="important-dates">
                <h2>Important Dates</h2>
                <ul>
                  {/* <li>11/21 - November Bagel Breakfast</li> */}
                  {/* <li>12/5 - Symphony Wireless Holiday Party</li> */}
                  <li>12/12 - December Bagel Breakfast</li>
                  <li>12/13 - Angel Tree Program Ends</li>
                  <li>12/19 - Ugly Sweater Day</li>
                </ul>
              </section>
              <section className="updates">
                <h2>IT Updates</h2>
                {/* <p className='imp-p'>Microsoft is experiencing outages on Teams and Outlook. We will update once the issues are resolved.</p> */}
                <p>Make Align appointment if you have a new laptop</p>
                <p>Do not click any phishing links</p>
              </section>
              <section className="quick-links">
                <h2>Quick Links</h2>
                {/* <button>HR Page</button>
                <button>Ask IT</button>
                <button>Salesforce</button>
                <button className="home-button" onClick={() => window.location.href = '/it'}>IT Page</button> */}
                <button className="home-button" onClick={() => window.open('https://symphonywireless.lightning.force.com/', '_blank')}>Salesforce</button>
                <button className="home-button" onClick={() => window.open('https://identity.trinet.com/', '_blank')}>Trinet</button>
                <button className="home-button" onClick={() => window.open('https://www.concursolutions.com/', '_blank')}>Concur</button>
                <button className="home-button" onClick={() => window.open('https://outlook.office.com/', '_blank')}>Outlook</button>
              </section>
            </aside>
          </div>
        </>
      ) : (
        <div className="unauthenticated-message">
          <h2>Welcome to the Symphony Wireless Intranet!</h2>
          <p>Please log in to access more features and content.</p>
        </div>
      )}
      <footer className="footer">
        <p>&copy; 2024 Symphony Wireless. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;