import React from 'react';
import Header from '../components/Header';
import Ticker from '../components/Ticker'
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
            <div className="grid-layout">
              {/* Card 1 */}
              <div className="card odd-card">
                <img src={img1} alt="Team Accomplishments" className="card-image" />
                <div className="card-text">
                  <h2>Company Annoucements</h2>
                  <ul>
                    <li>No rollover in October!</li>
                    <li>Record Breaking # of Signed LOIs at 36</li>
                    <li>Closed on 13 acquisitions and deployed $9.5M of capital</li>
                    <li>Brought in $490k of new GCF</li>
                    <li>Generated 123 opportunities worth $92M</li>
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
                    <li>12/4: California Wireless Association SoCal Holiday Party</li>
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
                    <li>RSVP for Symphony Holiday Party on December 5th</li>
                    {/* <li>Bagel Breakfast is November 21st</li> */}
                    <li>Enjoy your Thanksgiving break!</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="sidebar">
              <section className="important-dates">
                <h2>Important Dates</h2>
                <ul>
                  {/* <li>11/21 - November Bagel Breakfast</li> */}
                  <li>12/5 - Symphony Wireless Holiday Party</li>
                  <li>12/12 - Ugly Sweater Day</li>
                  <li>12/21 - December Bagel Breakfast</li>
                </ul>
              </section>
              <section className="updates">
                <h2>IT Updates</h2>
                <p className='imp-p'>Microsoft is experiencing outages on Teams and Outlook. We will update once the issues are resolved.</p>
                <p>Make Align appointment if you have a new laptop</p>
                <p>Do not click any phishing links</p>
              </section>
              <section className="quick-links">
                <h2>Quick Links</h2>
                <button>HR Page</button>
                <button>Ask IT</button>
                <button>Salesforce</button>
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