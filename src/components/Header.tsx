import React from 'react';
import '../../styles/header.css';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="logo">COMPANY LOGO</div>
      <nav className="nav-bar">
        <a href="/">Home</a>
        <a href="/news">News</a>
        <a href="/resources">Resources</a>
        <a href="/contact">Contact</a>
      </nav>
    </header>
  );
};

export default Header;