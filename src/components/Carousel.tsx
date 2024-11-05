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
    <div>
        <div className="carousel">
        <button className="carousel-button left" onClick={handlePrevClick}>
            &#8250; {/* Left arrow */}
        </button>
        <img src={images[currentIndex]} alt={`Slide ${currentIndex}`} className="carousel-image" />
        <button className="carousel-button right" onClick={handleNextClick}>
            &#8249; {/* Right arrow */}
        </button>
        </div>
        <div>
            <img src={test_image} alt="Test Image 1" />
        </div>
    </div>
  );
};

export default Carousel;