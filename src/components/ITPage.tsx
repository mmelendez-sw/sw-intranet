import React from 'react';
import '../../styles/it-page.css';

const ITPage: React.FC = () => {
  return (
    <div className="home-page">
      <div className="outermost-container">
        <div className="it-heading">
          <h1>IT Department</h1>
          <p>Welcome to the IT department</p>
        </div>
        <div className="it-main-columns">
          <div className="it-column blue-column">
            <h2>Release Notes</h2>
            <div className="column-content">
              <ul>
                <li>Version 2.1: Improved VPN stability</li>
                <li>Version 2.0: New self-service password reset</li>
                <li>Version 1.9: Security patch updates</li>
              </ul>
            </div>
          </div>
          <div className="it-column blue-column">
            <h2>Future Projects</h2>
            <div className="column-content">
              <ul>
                <li>Mobile Device Management rollout</li>
                <li>Cloud file storage migration</li>
                <li>New helpdesk ticketing system</li>
              </ul>
            </div>
          </div>
          <div className="it-column blue-column">
            <h2>FAQ</h2>
            <div className="column-content">
              <ul>
                <li>How do I reset my password?</li>
                <li>Where can I download company software?</li>
                <li>How do I contact IT support?</li>
              </ul>
            </div>
          </div>
        </div>
        <aside className="sidebar" style={{ width: '20%' }}>
          <section className="quick-links">
            <button className="home-button" onClick={() => window.open('mailto:Symphony_Tech@symphonywireless.com', '_self')}>Report Technology Issue</button>
          </section>
          <section className="updates">
            <h2>IT Updates</h2>
            <p>Do not click any phishing links</p>
          </section>
          <section className="quick-links">
            <h2>Quick Links</h2>
            <button className="home-button" onClick={() => window.open('https://symphonyinfra.my.salesforce.com/', '_blank')}>Salesforce</button>
            <button className="home-button" onClick={() => window.open('https://sitetracker-symphonyinfra.my.salesforce.com/', '_blank')}>SiteTracker</button>
            <button className="home-button" onClick={() => window.open('https://symphonysitesearch.app/', '_blank')}>Synaptek AI Search</button> 
            <button className="home-button" onClick={() => window.open('https://intranet.symphonywireless.com/reports', '_blank')}>Reports</button>
            <button className="home-button" onClick={() => window.open('https://identity.trinet.com/', '_blank')}>Trinet</button>
            <button className="home-button" onClick={() => window.open('https://www.concursolutions.com/', '_blank')}>Concur</button>
            <button className="home-button" onClick={() => window.open('https://system.netsuite.com/app/center/card.nl?c=8089687', '_blank')}>Netsuite</button>
            <button className="home-button" onClick={() => window.open('https://outlook.office.com/', '_blank')}>Outlook</button> 
          </section>
          <section className="updates">
            <h2>Exciting News</h2>
            <p>Palistar Capital combines Symphony Wireless with CTI Towers to form Symphony Towers Infrastructure (Symphony Towers). Read the <a href="https://www.prnewswire.com/news-releases/palistar-capital-announces-combination-of-us-wireless-assets-302350144.html" target="_blank" rel="noopener noreferrer">Press Release</a>.</p> 
          </section>
          <section className="updates">
            <h2>Holiday Party Photos</h2>
            <p>Linked below are the photos from our annual Holiday Party! Please browse when you have some time!</p>
            <a href="https://symphonywireless.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?FolderCTID=0x012000AAC1A88E36691940A87DC692E832396C&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FHoliday%20Party%202024" target="_blank" rel="noopener noreferrer">Holiday Party 2024</a>
          </section>
        </aside>
      </div>
      <footer className="footer">
        <p>&copy; 2025 Symphony Towers Infrastructure. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default ITPage;