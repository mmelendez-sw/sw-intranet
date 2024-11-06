import React from 'react';
import '../../styles/header.css';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="logo">COMPANY LOGO</div>
      <nav className="nav-bar">
        <a href="/">Home</a>
        <a href="/acquisitions">Acquisitions</a>
        <a href="/Pricing">Pricing</a>
        <a href="/legal">Legal</a>
        <a href="/hr">HR</a>
        <a href="/it">IT</a>
      </nav>
      <div className="user">Welcome, Matt!</div>
    </header>
  );
};

export default Header;