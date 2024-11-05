import React from 'react';
import '../styles/sidebar.css';

const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <ul>
        <li><a href="/myHR">myHR</a></li>
        <li><a href="/sap">SAP Fiori</a></li>
        <li><a href="/job-market">Job Market</a></li>
        <li><a href="/campus">Campus</a></li>
      </ul>
    </aside>
  );
};

export default Sidebar;