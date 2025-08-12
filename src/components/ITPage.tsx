import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/it-page.css';

const ITPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="home-page technology-page authenticated">
      <div className="content-container">
        <div className="main-content">
          {/* Business Reports Button */}
          <div className="business-reports-button-container">
            <button 
              className="home-button business-reports-button"
              onClick={() => navigate('/reports')}
            >
              Business Reports
            </button>
          </div>
          
          {/* Technology Updates - Large Card */}
          <div className="tech-updates-large-card">
            <div className="card odd-card" style={{ minHeight: 540 }}>
              <div className="card-text">
                <h2>Technology Updates</h2>
                <ul>
                  <li>New VPN rollout next month</li>
                  <li>Security awareness training available</li>
                  <li>Cloud migration in progress</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Technology Resources and FAQ - Two Smaller Cards */}
          <div className="tech-resources-faq-container">
            {/* Technology Resources Card */}
            <div className="card even-card blue-column" style={{ minHeight: 540 }}>
              <div className="card-text">
                <h2>Technology Resources</h2>
                <ul>
                  <li>Software Downloads</li>
                  <li>Technology Policies & Procedures</li>
                  <li>Helpful Guides</li>
                </ul>
              </div>
            </div>
            
            {/* FAQ Card */}
            <div className="card even-card blue-column" style={{ minHeight: 540 }}>
              <div className="card-text">
                <h2>FAQ</h2>
                <ul>
                  <li>How do I reset my password?</li>
                  <li>Where can I download company software?</li>
                  <li>How do I contact Technology support?</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <aside className="sidebar" style={{ width: '20%' }}>
          <section className="quick-links">
            <button className="home-button" onClick={() => window.open('mailto:Symphony_Tech@symphonywireless.com', '_self')}>Report Technology Issue</button>
          </section>
          <section className="updates">
            <h2>Technology Updates</h2>
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