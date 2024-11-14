import React from 'react';
import PhotoStream from '../components/PhotoStream'; // Ensure this is imported
import Carousel from '../components/Carousel'; // Ensure this is imported
import CalendarComponent from '../components/Calendar'; // Ensure this is imported
import '../../styles/home-page.css'; // Import your CSS file
import site2 from '../../images/site_2.jpg'
import food_drive_2 from '../../images/food_drive_2.jpg'

const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <PhotoStream /> 
      <div className="content-container">
        <div className="left-section">
          <div className="report-section">
            <h2>Current Analytics</h2>
            <Carousel />
          </div>
          <div className="doubles-section">
            <div className="column-container">
              <div className="press-section">
                <h2>Recent Press</h2>
                <img src={site2} alt={'Site'} className="site-image" />
                <p>Telecom Lease Buyouts & Symphony Wireless: Maximizing Value with The Partner of Choice</p>
              </div>
              <div className="events-section">
                <h2>Company Events</h2>
                <img src={food_drive_2} alt={'Site'} className="site-image" />
                <p><span className="date">11/4-11/15:</span> Food Drive</p>
                <p><span className="date">11/13:</span> Hudson Grille Happy Hour</p>
              </div>
            </div>
          </div>
        </div>


        <div className="right-section">    
          <div className="announcement-section">
            <h2>Important Dates/Holidays</h2>
            <p><span className="date">11/28:</span>  Thanksgiving Day</p>
            <p><span className="date">11/29:</span>  Black Friday</p>
            <p><span className="date">12/5:</span>  Symphony Wireless Holiday Party</p>
            <p><span className="date">12/25:</span>  Christmas Day</p>
            <p><span className="date">1/1:</span>  New Years Day</p>
          </div>
          <div className="it-section">
            <h2>IT Updates</h2>
            <p>New Laptops will be distibuted in batches</p>
            <p>Do not fall bait to any phishing links!</p>
          </div>
          <div className="calendar-section">
            <h2>Calendar</h2>
            <CalendarComponent />
          </div>
          <div className="quick-links">
            <div className="button-container">
              <button className="home-button" onClick={() => window.location.href = '/hr'}>HR Page</button>
              <button className="home-button" onClick={() => window.location.href = '/it'}>IT Page</button>
              <button className="home-button" onClick={() => window.open('https://www.symphonywireless.lightning.force.com/', '_blank')}>Salesforce</button>
              <button className="home-button" onClick={() => window.open('https://www.trinet.com/', '_blank')}>Trinet</button>
              <button className="home-button" onClick={() => window.open('https://www.concur.com/', '_blank')}>Concur</button>
              <button className="home-button" onClick={() => window.open('https://outlook.office.com/', '_blank')}>Outlook</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;