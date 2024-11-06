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
      {/* Banner overlay */}
      <div className="banner">
        <p>Welcome to Symphony Wireless</p>
      </div>
    </div>
  );
};

export default PhotoStream;