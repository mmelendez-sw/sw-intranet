import React, { useState, useEffect } from 'react';
import '../../styles/photo-stream.css';

import image1 from '../../images/site_1.jpg'
import image2 from '../../images/site_2.jpg'
// import image3 from '../../images/site_3.jpg'
import image4 from '../../images/site_4.jpg'
import image5 from '../../images/site_5.jpg'

const images = [
  image1,image2,image5,image4
];

const PhotoStream: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 10000); // Change every 3 seconds

    return () => clearInterval(interval); // Cleanup the interval on component unmount
  }, []);

  return (
    <div className="photo-stream">
      <img
        src={images[currentIndex]}
        alt={`Slide ${currentIndex}`}
        className="photo-stream-image"
      />
      {/* Scrolling Banner overlay */}
      <div className="ticker-wrap">
        <div className="ticker">
          <div className="ticker__item">- Food Drive is happening from 11/4-11/15!</div>
          <div className="ticker__item">- New Salesforce Workflow releasing in December</div>
          <div className="ticker__item">- Symphony Happy Hour at Hudson Grille on 11/13</div>
          <div className="ticker__item">- Wear your favorite team's jersey on 11/14!</div>
          <div className="ticker__item">- RSVP for the Holiday Party on 12/5!</div>
          <div className="ticker__item">- Fill out your personal goal sheet for 2025</div>
        </div>
      </div>
      <div className="update-section">
        <div className="column-container">
          <div className="marketing-section">
            <h2>Conferences and Events</h2>
            <p><span className="date">11/4-11/15:</span> New Jersey Wireless Association Holiday Social</p>
            <p><span className="date">11/13:</span> California Wireless Association SoCal Holiday Party</p>
            <p><span className="date">11/4-11/15:</span> ICSC New York</p>
            <p><span className="date">11/13:</span> Florida Wireless Association Charity Social and Golf Tournament</p>
          </div>
          <div className="hr-section">
            <h2>HR Announcements</h2>
            <p><span className="date">11/4-11/15:</span> Food Drive</p>
            <p><span className="date">11/13:</span> Hudson Grille Happy Hour</p>
            <p><span className="date">11/14:</span> Jersey Day</p>
            <p><span className="date">11/21:</span> November Bagel Breakfast</p>
            {/* <p>12/12: Jersey Day</p>
            <p>12/19: December Bagel Breakfast</p> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoStream;