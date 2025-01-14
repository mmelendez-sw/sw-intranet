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
              <h2>Message from HR</h2>
              <p>Please complete your Employee Self Evaluations by this Wednesday, January 15th.</p>
              {/* <p>Please ensure your teams are familiar with the new functionalities in preparation.</p> */}
            </div>
            <div className="grid-layout">
              {/* Card 1 */}
              <div className="card odd-card">
                <img src={img1} alt="Team Accomplishments" className="card-image" />
                <div className="card-text">
                  <h2>Company Announcements</h2>
                  <ul>
                      <li><strong>LOI Performance:</strong> December saw 27 LOIs signed (129% of target), committing $27M in capital (187% of goal). Year-end totals: 282 LOIs ($214.2M), achieving 123% and 140% of goals, respectively.</li>
                      <li><strong>Record Closings:</strong> December's 27 closings (193% of goal) set a Symphony record. Year-end: 149 closings (101% of target).</li>
                      <li><strong>Capital Deployment Milestone:</strong> $111.7M deployed in 2024 (108% of target), marking the first time Symphony surpassed $100M in a year.</li>
                      <li><strong>GCF Growth:</strong> Added nearly $1M in December, ending the year at $21.6M in annual GCF.</li>
                      <li><strong>Leasing Success:</strong> Over $318K in new amendments and collocation rents added in 2024.</li>
                  </ul>
                </div>
              </div>
              {/* Card 2 */}
              <div className="card even-card">
                <img src={img2} alt="Conferences & Events" className="card-image" />
                <div className="card-text">
                  <h2>HR Updates</h2>
                  <ul>
                    {/* <li>Employee Individual Bonus Goals due 12/31</li> */}
                    <li>Employee Self Evaluation due 1/15</li>
                    <li>Manager Performance Evaluations due 1/20</li>
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
                    <li>We provided the largest single donation that Feeding Westchester has ever received!</li>
                    <li>Thank you to everyone who chipped in this Thanksgiving season.</li>
                  </ul>
                </div>
                
              </div>
              {/* Card 5 */}
              <div className="card odd-card">
                <img src={img5} alt="Team Photo" className="card-image" />
                <div className="card-text">
                  <h2>Symphony Towers Infrastructure Team</h2>
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
                    {/* <li>Bagel Breakfast is December 12th!</li> */}
                    <li>Happy New Year!</li>
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
                  <li>1/16 - Bagel Breakfast</li>
                  <li>1/20 - Martin Luther King Jr. Day</li>
                  <li>1/23 - 2025 Kick Off</li>
                  <li>2/17 - President's Day</li>
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