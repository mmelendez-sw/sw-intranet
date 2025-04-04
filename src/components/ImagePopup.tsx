import React, { useEffect, useState } from 'react';
import '../styles/image-popup.css';
import employeeAppreciation from '../images/employee_appreciation.png';

interface ImagePopupProps {
  isAuthenticated: boolean;
}

const ImagePopup: React.FC<ImagePopupProps> = ({ isAuthenticated }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already seen the popup and if it's been less than 3 days
    const lastSeen = localStorage.getItem('lastSeenEmployeeAppreciation');
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
    
    const shouldShowPopup = !lastSeen || 
      (Date.now() - parseInt(lastSeen)) > threeDaysInMs;
    
    if (isAuthenticated && shouldShowPopup) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Store current timestamp when popup auto-closes
        localStorage.setItem('lastSeenEmployeeAppreciation', Date.now().toString());
      }, 8000); // Auto close after 10 seconds

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);

  const handleClose = () => {
    setIsVisible(false);
    // Store current timestamp when user manually closes
    localStorage.setItem('lastSeenEmployeeAppreciation', Date.now().toString());
  };

  if (!isVisible) return null;

  return (
    <div className="image-popup-overlay">
      <div className="image-popup-content">
        <button className="close-button" onClick={handleClose}>×</button>
        <img src={employeeAppreciation} alt="Employee Appreciation" className="popup-image" />
      </div>
    </div>
  );
};

export default ImagePopup; 