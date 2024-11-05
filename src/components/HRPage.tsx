import React from 'react';
import '../../styles/hr-page.css';

const HRPage: React.FC = () => {
  return (
    <div className="hr-page">
      <h1 >HR Department</h1>
      <p>Welcome to the HR Department! Here you will find resources related to HR policies, documents, and updates.</p>
      <ul>
        <li>Employee Benefits</li>
        <li>Company Policies</li>
        <li>Forms and Documents</li>
        <li>Contact HR Representatives</li>
      </ul>
    </div>
  );
};

export default HRPage;