import React from 'react';
import '../styles/it-page.css';

const ITPage: React.FC = () => {
  return (
    <div className="it-page">
      <h1>IT Department</h1>
      <p>Welcome to the IT Department! Here you will find resources related to technical support, guides, and IT updates.</p>
      <ul>
        <li>Technical Support</li>
        <li>Software Guides</li>
        <li>Hardware Policies</li>
        <li>Contact IT Helpdesk</li>
      </ul>
    </div>
  );
};

export default ITPage;