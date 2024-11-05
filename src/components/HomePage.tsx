import React from 'react';
import '../../styles/home-page.css';

const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <div className="button-section">
        <h2 style={{ color: 'red' }}>Quick Links</h2>
        <div className="button-container">
          {/* Internal Links */}
          <button className="link-button" onClick={() => window.location.href = '/hr'}>HR Page</button>
          <button className="link-button" onClick={() => window.location.href = '/it'}>IT Page</button>
          
          {/* External Links */}
          <button className="link-button" onClick={() => window.open('https://www.salesforce.com/', '_blank')}>Salesforce</button>
          <button className="link-button" onClick={() => window.open('https://www.trinet.com/', '_blank')}>Trinet</button>
          <button className="link-button" onClick={() => window.open('https://www.concur.com/', '_blank')}>Concur</button>
        </div>
      </div>
      <div className="calendar-section">
        <h2>Calendar</h2>
        <p>Event list and schedule will be shown here.</p>
      </div>
      <div className="report-section">
        <h2>Reporting</h2>
        <p>Graphs and data visualization will be shown here.</p>
      </div>
    </div>
  );
};

export default HomePage;