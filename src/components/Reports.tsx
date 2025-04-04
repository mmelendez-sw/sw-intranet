import React from 'react';
import '../styles/reports.css';

const reports = [
  {
    title: 'Daily Opportunity Count',
    description: 'A comprehensive status report on all current Symphony Towers Infrastructure Opportunities, Term Sheets, and Closed Rent.',
    link: 'https://app.powerbi.com/links/cJsxxPeDQx?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'All Acquisitions Summary',
    description: 'A comprehensive look at All Symphony Towers Infrastructure Acquisitions broken down by month, quarter, and year.',
    link: 'https://app.powerbi.com/links/PDJWKnYPlL?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare&bookmarkGuid=7983c722-1351-4091-a28b-023c2d74063b',
  },
  {title: 'TK Salesforce Sites',
    description: 'A comprehensive look at TK High Rent Relocation Sites and their status.',
    link: 'https://app.powerbi.com/links/ArNJaolb9U?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },  
  {title: 'Easement and Towers Report',
      description: 'A comprehensive look at Easements and Towers combined.',
      link: 'https://app.powerbi.com/links/EcIcSqZiXq?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    // title: 'Daily Acquisitions Summary',
    // description: 'A comprehensive look at the Symphony Towers Infrastructure Daily Acquisitions.',
    // link: 'https://app.powerbi.com/links/5E9lu5wCmG?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare&bookmarkGuid=d608bae3-6929-4c8f-995b-bb0c0b7cf15a',
  },
    {},  {},  {},  {},  {},  {},  {},  {},  {}
];

const TechnologyReports: React.FC = () => {
  return (
    <div className="home-page">
      <div className="outermost-container">
        <div className="reports-content-container">
          <div className="reports-text-bar">
             <h2>Symphony Towers Infrastructure Status Reports</h2>
          </div>
          <table className="reports-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report, index) => (
                <tr key={index} className={index % 2 === 0 ? 'odd-row' : 'even-row'}>
                  {/* <td style={{ height: '50px' }}>{report.title || ''}</td> */}  
                  <td>
                    {report.link ? (
                      <button 
                        className="report-button" 
                        onClick={() => window.open(report.link, '_blank')}
                      >
                        {report.title || ''}
                      </button>
                    ) : null}
                  </td>
                  <td style={{ height: '55px' }}>{report.description || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default TechnologyReports;
