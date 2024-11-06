import React from 'react';
import '../../styles/header.css';
import logo from '../../images/symph_white_t.png'

const Header: React.FC = () => {
  return (
    <header className="header">
      <img src={logo} alt={'Logo'} className="logo-image" />
      <nav className="nav-bar">
        <i className="fa-solid fa-house"></i> <a href="/"> Home</a>
        <i className="fa-solid fa-wifi"></i><a href="/acquisitions"> Acquisitions</a>
        <i className="fa-solid fa-wallet"></i><a href="/pricing"> Pricing</a>
        <i className="fa-brands fa-readme"></i><a href="/legal"> Legal</a>
        <i className="fa-solid fa-user"></i><a href="/hr"> HR</a>
        <i className="fa-solid fa-laptop"></i><a href="/it"> IT</a>
      </nav>
      <div className="user">Welcome, Matt!</div>
    </header>
  );
};

export default Header;