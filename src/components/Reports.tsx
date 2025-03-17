import React from 'react';
import Header from '../components/Header';
import '../../styles/reports.css';

const reports = [
  {
    title: 'Daily Opportunity Count',
    description: 'A comprehensive look at the Symphony Towers Infrastrucuture opportunity count.',
    link: 'https://app.powerbi.com/links/cJsxxPeDQx?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'All Acquisitions Summary',
    description: 'A comprehensive look at the Symphony Towers Infrastrucuture All Acquisitions count.',
    link: 'https://app.powerbi.com/links/PDJWKnYPlL?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare&bookmarkGuid=7983c722-1351-4091-a28b-023c2d74063b',
  },
  {
    title: 'Daily Acqusitions Summary',
    description: 'https://app.powerbi.com/links/5E9lu5wCmG?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare&bookmarkGuid=d608bae3-6929-4c8f-995b-bb0c0b7cf15a',
    link: 'https://example.com/cybersecurity-report',
  },
];

const TechnologyReports: React.FC = () => {
  return (
    <div className="home-page authenticated">
      <Header />
      <div className="outermost-container">
        <div className="content-container">
          <div className="grid-layout">
            {reports.map((report, index) => (
              <div key={index} className={`card ${index % 2 === 0 ? 'odd-card' : 'even-card'}`}>
                <div className="card-text">
                  <h2>{report.title}</h2>
                  <p>{report.description}</p>
                  <button className="home-button" onClick={() => window.open(report.link, '_blank')}>
                    View Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <aside className="sidebar">
              <section className="quick-links">
                <button className="home-button" onClick={() => window.open('mailto:Symphony_Tech@symphonywireless.com', '_self')}>Report Technology Issue</button>
              </section>
              <section className="updates">
                <h2>IT Updates</h2>
                {/* <p className='imp-p'>Microsoft is experiencing outages on Teams and Outlook. We will update once the issues are resolved.</p> */}
                {/* <p>Make Align appointment if you have a new laptop</p> */}
                <p>Do not click any phishing links</p>
              </section>
              <section className="quick-links">
                <h2>Quick Links</h2>
                {/* <button>HR Page</button>
                <button>Ask IT</button>
                <button>Salesforce</button>
                <button className="home-button" onClick={() => window.location.href = '/it'}>IT Page</button> */}
                <button className="home-button" onClick={() => window.open('https://symphonyinfra.my.salesforce.com/', '_blank')}>Salesforce</button>
                <button className="home-button" onClick={() => window.open('https://sitetracker-symphonyinfra.my.salesforce.com/?ec=302&startURL=%2Fvisualforce%2Fsession%3Furl%3Dhttps%253A%252F%252Fsitetracker-symphonywireless.lightning.force.com%252Flightning%252Fpage%252Fhome', '_blank')}>SiteTracker</button>
                <button className="home-button" onClick={() => window.open('https://symphonysitesearch.app/', '_blank')}>Synaptek AI Search</button> 
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
                {/* <p className='imp-p'>Microsoft is experiencing outages on Teams and Outlook. We will update once the issues are resolved.</p> */}
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

export default TechnologyReports;
