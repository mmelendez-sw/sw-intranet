import React, { useEffect } from 'react';
import '../../styles/image-popup.css';
import employeeAppreciationImage from '../../images/employee-appreciation.png';

interface ImagePopupProps {
  onClose: () => void;
}

const ImagePopup: React.FC<ImagePopupProps> = ({ onClose }) => {
  useEffect(() => {
    // Auto-close after 7 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 7000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={e => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <img src={employeeAppreciationImage} alt="Employee Appreciation" className="popup-image" />
      </div>
    </div>
  );
};

export default ImagePopup; 