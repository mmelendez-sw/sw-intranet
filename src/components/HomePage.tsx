import React from 'react';
import Header from '../components/Header';
import Ticker from '../components/Ticker';
import PhotoStream from '../components/PhotoStream';
import Carousel from '../components/Carousel';
import CalendarComponent from '../components/Calendar';
import '../../styles/home-page.css';

const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <Header />
      <Ticker />
      <PhotoStream /> {/* Ensure this is standalone and not nested within another container */}
      
      <div className="content-container">
        <div className="main-content">
          <section className="events">
            <div className="event">
              <h2>Company Events</h2>
              <p>11/21: November Bagel Breakfast</p>
              <p>12/12: Ugly Sweater Day</p>
              <p>12/5: Symphony Wireless Holiday Party</p>
              <p>12/21: December Bagel Breakfast</p>
            </div>
            <div className="event">
              <h2>Conferences & Events</h2>
              <p>11/20: New Jersey Wireless Association Holiday Social</p>
              <p>11/4: California Wireless Association SoCal Holiday Party</p>
              <p>12/11-12/12: ICSC New York</p>
              <p>12/13: Florida Wireless Association Charity Social and Golf Tournament</p>
            </div>
            <div className="event">
              <h2>Conferences & Events</h2>
              <p>Industry events and conference dates</p>
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
              <li>11/21 - Bagel Breakfast</li>
              <li>12/05 - Company Party</li>
            </ul>
          </section>
          <section className="quick-links">
            <h2>Quick Links</h2>
            <button>HR Page</button>
            <button>IT Page</button>
            <button>Salesforce</button>
          </section>
        </aside>
      </div>

      <footer className="footer">
        <p>&copy; 2024 Symphony Wireless. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;