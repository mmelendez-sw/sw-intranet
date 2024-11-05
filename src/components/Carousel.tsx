import React, { useState } from 'react';
import '../../styles/carousel.css';

const images = [
  '../../../images/cr_1.png', // Replace with your image paths
  '../../../images/cr_2.png',
  '../../../images/ts_1.png',
  '../../../images/ts_2.png',
];

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
    <div className="carousel">
      <button className="carousel-button left" onClick={handlePrevClick}>
        &#8250; {/* Left arrow */}
      </button>
      <img src={images[currentIndex]} alt={`Slide ${currentIndex}`} className="carousel-image" />
      <button className="carousel-button right" onClick={handleNextClick}>
        &#8249; {/* Right arrow */}
      </button>
    </div>
  );
};

export default Carousel;