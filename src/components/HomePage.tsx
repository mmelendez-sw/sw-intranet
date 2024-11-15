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
      <Ticker /> {/* Add the Ticker component here for fixed scrolling updates */}
      
      <PhotoStream />

      <div className="content-container">
        <div className="main-content">
          <section className="analytics-section">
            <h2>Current Analytics</h2>
            <Carousel />
          </section>
          <section className="events">
            <div className="event">
              <h2>Company Events</h2>
              <p>Details on upcoming company events</p>
            </div>
            <div className="event">
              <h2>Conferences & Events</h2>
              <p>Industry events and conference dates</p>
            </div>
          </section>
        </div>

        <aside className="sidebar">
          <section className="updates">
            <h2>IT Updates</h2>
            <p>Important announcements from IT</p>
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