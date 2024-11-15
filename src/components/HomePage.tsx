import React from 'react';
import PhotoStream from '../components/PhotoStream'; // Ensure this is imported
import Carousel from '../components/Carousel'; // Ensure this is imported
import CalendarComponent from '../components/Calendar'; // Ensure this is imported
import '../../styles/home-page.css'; // Import your CSS file
import site2 from '../../images/site_2.jpg'
import food_drive_2 from '../../images/food_drive_2.jpg'
import Header from '../components/Header'

const HomePage: React.FC = () => {
    return (
      <div className="home-page">
        <PhotoStream /> 
        <div className="content-container">
          <div className="main-content">
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
            <section className="analytics-section">
              <h2>Current Analytics</h2>
              <Carousel />
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
          <p>&copy; 2024 Company Name. All rights reserved.</p>
        </footer>
      </div>
  );
};

export default HomePage;