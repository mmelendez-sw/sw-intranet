import React from 'react';
import '../styles/reports.css';
import { useAuth } from '../contexts/AuthContext';
import { reports, eliteReports, shouldShowReport } from '../data/reportsData';
import { Button } from './common/Button';

const TechnologyReports: React.FC = () => {
  const { userInfo } = useAuth();

  // Filter reports based on elite group status and excluded emails
  let displayReports = userInfo.isEliteGroup 
    ? [...eliteReports, ...reports] 
    : reports;
  
  // Filter out reports that the user should not see based on their email
  displayReports = displayReports.filter(report => 
    shouldShowReport(report, userInfo.email)
  );
  
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
                    {report.title && (
                      report.link ? (
                        <Button 
                          variant="outline"
                          onClick={() => window.open(report.link, '_blank')}
                          className="report-button"
                        >
                          {report.title}
                        </Button>
                      ) : (
                        <Button variant="outline" className="report-button" disabled>
                          {report.title}
                        </Button>
                      )
                    )}
                  </td>
                  <td style={{ height: '55px' }}>{report.description || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="sidebar" style={{ width: '20%' }}>
          <section className="quick-links">
            <Button 
              onClick={() => window.open('mailto:Symphony_Tech@symphonywireless.com', '_self')}
              variant="primary"
              className="home-button"
            >
              Report Technology Issue
            </Button>
          </section>
          <section className="updates">
            <h2>IT Updates</h2>
            <p>Do not click any phishing links</p>
          </section>
          <section className="quick-links">
            <h2>Quick Links</h2>
            <Button 
              onClick={() => window.open('https://symphonyinfra.my.salesforce.com/', '_blank')}
              variant="primary"
              className="home-button"
            >
              Salesforce
            </Button>
            <Button 
              onClick={() => window.open('https://symphonyinfra.my.salesforce.com/', '_blank')}
              variant="primary"
              className="home-button"
            >
              SiteTracker
            </Button>
            <Button 
              onClick={() => window.open('https://symphonysitesearch.app/', '_blank')}
              variant="primary"
              className="home-button"
            >
              Synaptek AI Search
            </Button>
            {userInfo.isEliteGroup ? (
              <Button 
                onClick={() => window.open('https://intranet.symphonywireless.com/technology', '_blank')}
                variant="primary"
                className="home-button"
              >
                Elite Reports
              </Button>
            ) : (
              <Button 
                onClick={() => window.open('https://intranet.symphonywireless.com/technology', '_blank')}
                variant="primary"
                className="home-button"
              >
                Reports
              </Button>
            )}
            <Button 
              onClick={() => window.open('https://identity.trinet.com/', '_blank')}
              variant="primary"
              className="home-button"
            >
              Trinet
            </Button>
            <Button 
              onClick={() => window.open('https://www.concursolutions.com/', '_blank')}
              variant="primary"
              className="home-button"
            >
              Concur
            </Button>
            <Button 
              onClick={() => window.open('https://system.netsuite.com/app/center/card.nl?c=8089687', '_blank')}
              variant="primary"
              className="home-button"
            >
              Netsuite
            </Button>
            <Button 
              onClick={() => window.open('https://outlook.office.com/', '_blank')}
              variant="primary"
              className="home-button"
            >
              Outlook
            </Button>
          </section>
          <section className="updates">
            <h2>Exciting News</h2>
            <p>
              Palistar Capital combines Symphony Wireless with CTI Towers to form Symphony Towers Infrastructure (Symphony Towers). 
              Read the{' '}
              <a 
                href="https://www.prnewswire.com/news-releases/palistar-capital-announces-combination-of-us-wireless-assets-302350144.html" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Press Release
              </a>.
            </p>
          </section>
          <section className="updates">
            <h2>Holiday Party Photos</h2>
            <p>Linked below are the photos from our annual Holiday Party! Please browse when you have some time!</p>
            <a 
              href="https://symphonywireless.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?FolderCTID=0x012000AAC1A88E36691940A87DC692E832396C&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FHoliday%20Party%202024" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Holiday Party 2024
            </a>
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
