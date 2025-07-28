import React from 'react';
import '../styles/reports.css';
import { UserInfo } from '../types/user';

interface TechnologyReportsProps {
  userInfo: UserInfo;
}

const reports = [
  {
    title: 'All Acquisitions Summary',
    description: 'A comprehensive look at All Symphony Towers Infrastructure Acquisitions broken down by month, quarter, and year.',
    link: 'https://app.powerbi.com/links/PDJWKnYPlL?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'Daily Opportunity Count',
    description: 'A comprehensive status report on all current Symphony Towers Infrastructure Opportunities, Term Sheets, and Closed Rent.',
    link: 'https://app.powerbi.com/links/cJsxxPeDQx?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'Portfolio Pipeline',
    description: 'A comprehensive look at the Symphony Towers Infrastructure Portfolio pipeline.',
    link: 'https://app.powerbi.com/links/EJYOMILU2S?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'Tower Purchase Opportunities',
    description: 'A complete view of all opportunities with the Tower Purchase transaction type.',
    link: 'https://app.powerbi.com/links/15otqb7SY1?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare&bookmarkGuid=44739935-cc8c-4072-8232-79d8be3360f8',
  },  
  {title: 'Closing - Pipeline', 
    description: 'A comprehensive look at the Symphony Towers Infrastructure Closing Pipeline.',
    link: 'https://app.powerbi.com/links/Cs4H7e-pez?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare'
  }, 
  {
    title: 'Signed LOIs - SNDA',
    description: 'A comprehensive look at Signed Letters of Intent and Subordination, Non-Disturbance, and Attornment agreements.',
    link: 'https://app.powerbi.com/links/M87CTzygq_?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'WIP - Daily Acquisitions Summary',
    description: 'Work In Progress - A comprehensive look at the Symphony Towers Infrastructure Daily Acquisitions.',
  },
  {
    title: 'WIP - In-Month Conversion Tracker',
    description: 'Work In Progress - A tracker to view opportunity conversions by month.',
  },  
  {
    title: 'WIP - TS and CR Trends Report',
    description: 'Work In Progress - A comprehensive look at trends in Term Sheets and Closed Rent.',
  },
  {
    title: 'Site Tracker - Easement and Towers Report',
    description: 'A comprehensive look at Easements and Towers combined.',
    link: 'https://app.powerbi.com/links/EcIcSqZiXq?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'Site Tracker - Sales Pipeline Activity',
    description: 'A comprehensive look at current sales pipeline activity.',
    link: 'https://app.powerbi.com/links/ucuKVV73py?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'TK Salesforce Sites',
    description: 'A comprehensive look at TK High Rent Relocation Sites and their status.',
    link: 'https://app.powerbi.com/links/ArNJaolb9U?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
];

// Elite reports - additional reports for elite group members
const eliteReports = [
  {
    title: 'Elite - Origination Pipeline',
    description: 'A comprehensive look at the Symphony Towers Infrastructure Origination Pipeline.',
    link: 'https://app.powerbi.com/links/lUwfP_rkT6?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
];

const TechnologyReports: React.FC<TechnologyReportsProps> = ({ userInfo }) => {
  const displayReports = userInfo.isEliteGroup ? [...eliteReports, ...reports] : reports;
  const pageTitle = userInfo.isEliteGroup 
    ? 'Symphony Towers Infrastructure Elite Status Reports' 
    : 'Symphony Towers Infrastructure Status Reports';

  return (
    <div className="home-page">
      <div className="outermost-container">
        <div className="reports-content-container">
          <div className="reports-text-bar">
             <h2>{pageTitle}</h2>
             {userInfo.isEliteGroup && (
               <div style={{ 
                 backgroundColor: '#f0f0f0', 
                 color: '#333', 
                 padding: '8px', 
                 borderRadius: '4px', 
                 marginTop: '10px',
                 fontSize: '0.9em',
                 fontStyle: 'italic'
               }}>
                 Elite Access - Additional reports available
               </div>
             )}
          </div>
          <table className="reports-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
            {displayReports.map((report, index) => (
              <tr key={index} className={index % 2 === 0 ? 'odd-row' : 'even-row'}>
                <td>
                  {report.title ? (
                    report.link ? (
                      <button 
                        className="report-button" 
                        onClick={() => window.open(report.link, '_blank')}
                      >
                        {report.title}
                      </button>
                    ) : (
                      <button className="report-button">
                        {report.title}
                      </button>
                    )
                  ) : null}
                </td>
                <td style={{ height: '55px' }}>{report.description || ''}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
        <aside className="sidebar sidebar-narrow" style={{ padding: '16px', minWidth: '500px', maxWidth: '600px', boxSizing: 'border-box', marginLeft: '-24px' }}>
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
            <button className="home-button" onClick={() => window.open('https://sitetracker-symphonyinfra.my.salesforce.com/?ec=302&startURL=%2Fvisualforce%2Fsession%3Furl%3Dhttps%253A%252F%252Fsitetracker-symphonywireless.lightning.force.com%252Flightning%252Fpage%252Fhome', '_blank')}>SiteTracker</button>
            <button className="home-button" onClick={() => window.open('https://symphonysitesearch.app/', '_blank')}>Synaptek AI Search</button> 
            {userInfo.isEliteGroup ? (
              <button className="home-button" onClick={() => window.open('https://intranet.symphonywireless.com/technology', '_blank')}>Elite Reports</button>
            ) : (
              <button className="home-button" onClick={() => window.open('https://intranet.symphonywireless.com/technology', '_blank')}>Reports</button>
            )}
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
