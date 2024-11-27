import React from 'react';
import '../../styles/under-development.css';

const UnderDevelopment: React.FC = () => {
    return (
        <div className="under-development">
            <div className="container">
                <h1>Page Under Development</h1>
                <p>We're working hard to bring this page to life. Stay tuned!</p>
                <button 
                    className="back-button" 
                    onClick={() => window.history.back()}
                >
                    Go Back
                </button>
            </div>
        </div>
    );
};

export default UnderDevelopment;