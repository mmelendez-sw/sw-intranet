import React from 'react';
import Header from '../components/Header';
import Ticker from '../components/Ticker';
import PhotoStream from '../components/PhotoStream';
import Carousel from '../components/Carousel';
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
  return (
    <div className="home-page">
      <Header />
      <PhotoStream /> {/* Always visible */}
      {isAuthenticated && <Ticker />} {/* Conditional rendering for Ticker */}
      {isAuthenticated ? (
        <div className="content-container">
          <div className="main-content">
            <section className="events">
              <div className="event blue-background">
                <div className="event-content">
                  <div className="event-text">
                    <h2>October Team Accomplishments</h2>
                    <p>No rollover in October!</p>
                    <p>Record Breaking # of Signed LOIs at 36</p>
                    <p>Closed on 13 acquisitions and deployed $9.5M of capital</p>
                    <p>Brought in $490k of new GCF</p>
                    <p>Generated 123 opportunities worth $92M</p>
                  </div>
                  <img src={img1} alt="Marketing Updates" />
                </div>
              </div>
              <div className="event white-background">
                <div className="event-content">
                  <img src={img2} alt="Conferences & Events" />
                  <div className="event-text right">
                    <h2>Conferences & Events</h2>
                    <p>11/20: New Jersey Wireless Association Holiday Social</p>
                    <p>11/4: California Wireless Association SoCal Holiday Party</p>
                    <p>12/11-12/12: ICSC New York</p>
                    <p>12/13: Florida Wireless Association Charity Social and Golf Tournament</p>
                  </div>
                </div>
              </div>
              <div className="event blue-background">
                <div className="event-content">
                  <div className="event-text">
                    <h2>Marketing Updates</h2>
                    <p>Connect with Justin or Arwa for any marketing email questions</p>
                    <p>Marketing leads will be distributed based on your directors</p>
                  </div>
                  <img src={img3} alt="Team Accomplishments" />
                </div>
              </div>
            </section>
            <section className="analytics-section">
              <h2>Current Analytics</h2>
              <Carousel />
            </section>
          </div>

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
            <section className="updates">
              <h2>Food Drive Update</h2>
              <img src={img4} alt="Food Drive" className="update-image" />
            </section>
            <section className="updates">
              <h2>Symphony Wireless Team</h2>
              <img src={img5} alt="Team Photo" className="update-image" />
            </section>
          </aside>
        </div>
      ) : null}
      <footer className="footer">
        <p>&copy; 2024 Symphony Wireless. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;