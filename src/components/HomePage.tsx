import React from 'react';
import Carousel from './Carousel';
import '../../styles/home-page.css';

const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <div className="left-section">
        <div className="report-section">
          <h2>Reports</h2>
          <Carousel />
        </div>
        <div className="industry-news-section">
          <h2>Industry News</h2>
          <p>Latest news and updates will be shown here.</p>
        </div>
      </div>

      <div className="right-section">
        <div className="quick-links">
          <h2>Quick Links</h2>
          <div className="button-container">
            <button onClick={() => window.location.href = '/hr'}>HR Page</button>
            <button onClick={() => window.location.href = '/it'}>IT Page</button>
            <button onClick={() => window.open('https://www.symphonywireless.lightning.force.com/', '_blank')}>Salesforce</button>
            <button onClick={() => window.open('https://www.trinet.com/', '_blank')}>Trinet</button>
            <button onClick={() => window.open('https://www.concur.com/', '_blank')}>Concur</button>
            <button onClick={() => window.open('https://outlook.office.com/', '_blank')}>Outlook</button>
          </div>
        </div>
        <div className="announcement-section">
          <h2>HR Announcements</h2>
          <p>Important HR announcements will be displayed here.</p>
        </div>
        <div className="announcement-section">
          <h2>Marketing Announcements</h2>
          <p>Important Marketing announcements will be displayed here.</p>
        </div>
        <div className="calendar-section">
          <h2>Calendar</h2>
          <p>Event list and schedule will be shown here.</p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;