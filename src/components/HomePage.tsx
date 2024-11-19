import React from 'react';
import Header from '../components/Header';
import '../../styles/home-page.css';

import img1 from '../../images/site_1.jpg';
import img2 from '../../images/site_2.jpg';
import img3 from '../../images/site_3.jpg';
import img4 from '../../images/food_drive_2.jpg';
import img5 from '../../images/team.jpg';

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
              <div className="card">
                <img src={img1} alt="Team Accomplishments" className="card-image" />
                <div className="card-text">
                  <h2>October Team Accomplishments</h2>
                  <p>No rollover in October!</p>
                  <p>Record Breaking # of Signed LOIs at 36</p>
                  <p>Closed on 13 acquisitions and deployed $9.5M of capital</p>
                  <p>Brought in $490k of new GCF</p>
                  <p>Generated 123 opportunities worth $92M</p>
                </div>
              </div>
              {/* Card 2 */}
              <div className="card">
                <img src={img2} alt="Conferences & Events" className="card-image" />
                <div className="card-text">
                  <h2>Conferences & Events</h2>
                  <p>11/20: New Jersey Wireless Association Holiday Social</p>
                  <p>11/4: California Wireless Association SoCal Holiday Party</p>
                  <p>12/11-12/12: ICSC New York</p>
                  <p>12/13: Florida Wireless Association Charity Golf Tournament</p>
                </div>
              </div>
              {/* Card 3 */}
              <div className="card">
                <img src={img3} alt="Marketing Updates" className="card-image" />
                <div className="card-text">
                  <h2>Marketing Updates</h2>
                  <p>Connect with Justin or Arwa for any marketing email questions</p>
                  <p>Marketing leads will be distributed based on your directors</p>
                </div>
              </div>
              {/* Card 4 */}
              <div className="card">
                <img src={img4} alt="Food Drive" className="card-image" />
                <div className="card-text">
                  <h2>Food Drive Update</h2>
                  <p>Help us make a difference with our annual food drive!</p>
                </div>
              </div>
              {/* Card 5 */}
              <div className="card">
                <img src={img5} alt="Team Photo" className="card-image" />
                <div className="card-text">
                  <h2>Symphony Wireless Team</h2>
                  <p>Meet the team that makes everything possible.</p>
                </div>
              </div>
              {/* Card 6 */}
              <div className="card">
                <div className="card-text">
                  <h2>Additional Updates</h2>
                  <p>Stay tuned for more exciting announcements!</p>
                </div>
              </div>
              <div className="card">
                <img src={img4} alt="Food Drive" className="card-image" />
                <div className="card-text">
                  <h2>Food Drive Update</h2>
                  <p>Help us make a difference with our annual food drive!</p>
                </div>
              </div>
              <div className="card">
                <img src={img4} alt="Food Drive" className="card-image" />
                <div className="card-text">
                  <h2>Food Drive Update</h2>
                  <p>Help us make a difference with our annual food drive!</p>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="sidebar">
              <section className="updates">
                <h2>HR Announcements</h2>
                <p>Important announcements from HR</p>
              </section>
              <section className="updates">
                <h2>IT Updates</h2>
                <p>Make Align appointment if you have a new laptop</p>
                <p>Do not click any phishing links</p>
              </section>
              <section className="important-dates">
                <h2>Important Dates</h2>
                <ul>
                  <li>11/21 - November Bagel Breakfast</li>
                  <li>12/5 - Symphony Wireless Holiday Party</li>
                  <li>12/12 - Ugly Sweater Day</li>
                  <li>12/21 - December Bagel Breakfast</li>
                </ul>
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