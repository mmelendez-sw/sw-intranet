import React, { useState, useEffect } from 'react';
import '../../styles/photo-stream.css';

const image1 = '../../site_1.jpg'
const images = [
  image1
];

const PhotoStream: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000); // Change every 3 seconds

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