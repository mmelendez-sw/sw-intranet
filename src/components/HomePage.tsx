import React from 'react';
import PhotoStream from '../components/PhotoStream'; // Ensure this is imported
import Carousel from '../components/Carousel'; // Ensure this is imported
import CalendarComponent from '../components/Calendar'; // Ensure this is imported
import '../../styles/home-page.css'; // Import your CSS file
import site2 from '../../images/site_2.jpg'
import food_drive from '../../images/food_drive.jpeg'

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
                <h2>LinkedIn Articles</h2>
                <img src={site2} alt={'Site'} className="site-image" />
                <p>Telecom Lease Buyouts & Symphony Wireless: Maximizing Value with The Partner of Choice</p>
              </div>
              <div className="events-section">
                <h2>Company Events</h2>
                <img src={food_drive} alt={'Site'} className="site-image" />
                <p>11/4-11/15: Food Drive</p>
                <p>11/13: Hudson Grille Happy Hour</p>
              </div>
            </div>
          </div>
        </div>


        <div className="right-section">    
          <div className="announcement-section">
            <h2>Important Dates</h2>
            <p>11/14: Jersey Day</p>
            <p>11/28: Thanksgiving Day</p>
            <p>11/29: Black Friday</p>
            <p>12/5: Symphony Wireless Holiday Party</p>
          </div>
          <div className="it-section">
            <h2>IT Updates</h2>
            <p>Everyone is getting new laptops</p>
            <p>Do not click any phishing links!</p>
          </div>
          <div className="quick-links">
            <div className="button-container">
              <button onClick={() => window.location.href = '/hr'}>HR Page</button>
              <button onClick={() => window.location.href = '/it'}>IT Page</button>
              <button onClick={() => window.open('https://www.symphonywireless.lightning.force.com/', '_blank')}>Salesforce</button>
              <button onClick={() => window.open('https://www.trinet.com/', '_blank')}>Trinet</button>
              <button onClick={() => window.open('https://www.concur.com/', '_blank')}>Concur</button>
              <button onClick={() => window.open('https://outlook.office.com/', '_blank')}>Outlook</button>
            </div>
          </div>
          <div className="calendar-section">
            <h2>Calendar</h2>
            <CalendarComponent />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;