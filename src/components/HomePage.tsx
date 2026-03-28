import React from 'react';
import '../../styles/home-page.css';


import img3 from '../../images/site_3.jpg';
import img4 from '../../images/coat.jpg';
import img7 from '../../images/mm2.jpg'
import img9 from '../../images/vol.jpg'
import img10 from '../../images/emp.jpg'
import img10Md from '../../images/emp_md.jpg'
import img10Sm from '../../images/emp_sm.jpg'
import img11 from '../../images/750_app.png'

interface HomePageProps {
  isAuthenticated: boolean;
}

const HomePage: React.FC<HomePageProps> = ({ isAuthenticated }) => {
  console.log('HomePage Render - isAuthenticated:', isAuthenticated);

  return (
    <div className={`home-page ${isAuthenticated ? 'authenticated' : 'unauthenticated'}`}>
      {isAuthenticated ? (
        <>
          <div className="content-container">
            <div className="grid-layout">
              {/* Card 1 */}
              <div className="card odd-card">
                <img src={img9} alt="Meals on Main Street" className="card-image" style={{ objectFit: 'contain' }} />
                <div className="card-text">
                  <h2>Important Dates</h2>
                  <ul>
                      <li>April - Q1 Performance Reviews</li>
                      <li>4/3: Good Friday</li>
                      <li>5/25: Memorial Day</li>
                      <li>6/19: Juneteenth</li>
                      <li>July - Q2 Performance Reviews</li>
                      <li>7/3: Independence Day Observed</li>
                  </ul>
                </div>
              </div>
              {/* Card 2 */}
              <div className="card even-card">
                <img src={img11} alt="Bowling 2025" className="card-image" />
                <div className="card-text">
                  <h2>New Employee Leads App</h2>
                  <ul>
                    <li>
                      Our goal is to collect 2 leads per month per employee. 
                    </li>
                    <li>
                      This initiative is a part of our company-wide goals for the year. 
                    </li>
                    <li>
                      <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/_layouts/15/stream.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared+Documents%2FMarketing%2FMobile+Application%2FSymphony+Towers+Employee+Leads+App+Promo.mp4&startedResponseCatch=true&referrer=StreamWebApp.Web&referrerScenario=AddressBarCopied.view.6ed79924-e884-4365-b062-18e93c0a0912" target="_blank" rel="noopener noreferrer">CLICK HERE</a> to learn more about our 2 leads initiative.
                    </li>
                    <li>
                      <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/_layouts/15/stream.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FMarketing%2FMobile%20Application%2FEmployee%20Leads%20App%20%2D%20Download%20Instructional%20Demo%20Video%2Emp4&referrer=StreamWebApp%2EWeb&referrerScenario=AddressBarCopied%2Eview%2Eb252ef14%2Dee35%2D474b%2D8a55%2D7418b4c2f0c0" target="_blank" rel="noopener noreferrer">CLICK HERE</a> to learn how to download the app. 
                    </li>
                  </ul>
                </div>
              </div>
              {/* <div className="card even-card">
                <img src={img11} alt="Bowling 2025" className="card-image" />
                <div className="card-text">
                  <h2>New Employee Leads App</h2>
                  <ul>
                    <li>
                      Our goal is to collect 2 leads per month per employee. 
                    </li>
                    <li>
                      This initiative is a part of our company-wide goals for the year. 
                    </li>
                    <li>
                      <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/_layouts/15/stream.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared+Documents%2FMarketing%2FMobile+Application%2FSymphony+Towers+Employee+Leads+App+Promo.mp4&startedResponseCatch=true&referrer=StreamWebApp.Web&referrerScenario=AddressBarCopied.view.6ed79924-e884-4365-b062-18e93c0a0912" target="_blank" rel="noopener noreferrer">CLICK HERE</a> to learn more about our 2 leads initiative.
                    </li>
                    <li>
                      <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/_layouts/15/stream.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FMarketing%2FMobile%20Application%2FEmployee%20Leads%20App%20%2D%20Download%20Instructional%20Demo%20Video%2Emp4&referrer=StreamWebApp%2EWeb&referrerScenario=AddressBarCopied%2Eview%2Eb252ef14%2Dee35%2D474b%2D8a55%2D7418b4c2f0c0" target="_blank" rel="noopener noreferrer">CLICK HERE</a> to learn how to download the app. 
                    </li>
                  </ul>
                </div>
              </div> */}
              {/* Card 3 */}
              <div className="card odd-card">
                <img src={img7} alt="March Madness" className="card-image" style={{ objectPosition: '30% center' }} />
                <div className="card-text">
                  <h2>March Madness</h2>
                  <ul>
                    <li>Thank you to everyone who came out to Buffalo Wild Wings for our March Madness event! It was a great time cheering on our brackets together.</li>
                    <li>We hope everyone enjoyed the food, fun, and team spirit. Looking forward to more events like this!</li>
                  </ul>
                </div>
              </div>
              {/* Card 4 */}
              <div className="card even-card">
                <img src={img4} alt="Food Drive" className="card-image" />
                <div className="card-text">
                  <h2>Person to Person Coat Drive</h2>
                  <ul>
                    <li>Thank you to our volunteers who joined us for the Person to Person coat drive in Darien, CT! Your kindness keeps our community warm.</li>
                  </ul>
                </div>
              </div>
              {/* Card 5 */}
              <div className="card odd-card">
                <img src={img3} alt="Marketing Updates" className="card-image" />
                <div className="card-text">
                  <h2>Marketing Updates</h2>
                  <ul>
                    <li>We're excited to share that our company logo has been updated as part of our ongoing brand refresh.
                      To support this update, we've created a shared folder with updated logo files, templates, and brand collateral for your use. This folder will continue to be updated as additional materials become available.
                      If you have any questions or need assistance, please feel free to reach out to Justin or Arwa.
                      Thank you for helping us maintain a consistent and professional brand presence.</li>
                    <li>
                      <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?csf=1&web=1&e=XUzv8z&ovuser=63fbe43e%2D8963%2D4cb6%2D8f87%2D2ecc3cd029b4&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FMarketing&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd" target="_blank" rel="noopener noreferrer">New Symphony Branding</a>
                    </li>
                    <li>Additionally, linked below are marketing reports from our Inside Towers company subscription and a link to their most recent quarterly briefing.</li>
                    <li>
                      <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?csf=1&web=1&e=XUzv8z&ovuser=63fbe43e%2D8963%2D4cb6%2D8f87%2D2ecc3cd029b4&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FMarketing%2FInside%20Towers%20Market%20Reports&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd" target="_blank" rel="noopener noreferrer">Inside Towers Market Reports</a>
                    </li>
                    <li>
                      <a href="https://www.youtube.com/watch?v=AUj_-d7XSPI" target="_blank" rel="noopener noreferrer">Inside Towers Quarterly Briefing</a>
                    </li>
                  </ul>       
                </div>
              </div>  
              {/* Card 6 */}
              <div className="card even-card">
                <img
                  src={img10}
                  srcSet={`${img10Sm} 480w, ${img10Md} 900w, ${img10} 1200w`}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  alt="Employee Appreciation Day Celebration"
                  className="card-image employee-appreciation-image"
                />
                <div className="card-text">
                  <h2>Employee Appreciation Day Celebration</h2>
                  <ul>
                    <li>Thank you to every team member for your dedication, positive energy, and hard work - your contributions are the reason our Employee Appreciation Day was such a success.</li>
                  </ul>
                </div>
              </div>
            </div>

            <aside className="sidebar">
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
                <button className="home-button" onClick={() => window.open('https://symphonyinfra.my.salesforce.com/', '_blank')}>SiteTracker</button>
                <button className="home-button" onClick={() => window.open('https://symphonysitesearch.app/', '_blank')}>Synaptek AI Search</button>
                <button className="home-button" onClick={() => window.open('https://intranet.symphonywireless.com/technology', '_blank')}>Reports</button>
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
                <h2>2025 Holiday Party Photos</h2>
                <p>Linked below are the photos from our annual Holiday Party! Please browse when you have some time!</p>
                <a href="https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FHoliday%20Party%202025&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd&CT=1765897007566&OR=OWA%2DNT%2DMail&CID=3f303088%2D887e%2D5f5d%2Dc796%2D8c05e6dfe58c&csf=1&web=1&e=KiM4Nf&FolderCTID=0x012000AAC1A88E36691940A87DC692E832396C" target="_blank" rel="noopener noreferrer">Holiday Party 2025</a>
              </section>
            </aside>
          </div>
        </>
      ) : (
        <div className="unauthenticated-message">
          <h2>Welcome to the Symphony Towers Infrastructure Intranet!</h2>
          <p>Please log in to access more features and content.</p>
        </div>
      )}
      <footer className="footer">
        <p>&copy; 2025 Symphony Towers Infrastructure. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;
