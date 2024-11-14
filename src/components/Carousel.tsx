import React, { useState } from 'react';
import '../../styles/carousel.css';

import image1 from '../../images/cr_1.png';
import image2 from '../../images/cr_2.png';
import image3 from '../../images/ts_1.png';
import image4 from '../../images/ts_2.png';

import test_image from '../images/cr_1.png'

const images = [image1, image2, image3, image4];

const Carousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevClick = () => {
    const newIndex = (currentIndex - 1 + images.length) % images.length;
    setCurrentIndex(newIndex);
  };

  const handleNextClick = () => {
    const newIndex = (currentIndex + 1) % images.length;
    setCurrentIndex(newIndex);
  };

  return (
    <div className="carousel-container">
      <div className="carousel">
        <img src={images[currentIndex]} alt={`Slide ${currentIndex}`} className="carousel-image" />
        <div className="carousel-controls">
          <button onClick={handlePrevClick} className="carousel-button left">◄</button>
          <button onClick={handleNextClick} className="carousel-button right">►</button>
        </div>
      </div>
    </div>
  );
};

export default Carousel;