import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import '../../styles/header.css';
import white_logo from '../../images/symph_white_t.png';
import sti_logo from '../../images/STI.png'
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from '../authConfig';
// import ImagePopup from './ImagePopup';

const Header: React.FC = () => {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  // const [showPopup, setShowPopup] = useState(false);

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch((e) => {
      console.error(e);
    });
  };

  const handleLogout = () => {
    instance.logoutPopup().catch((e) => {
      console.error(e);
    });
    setIsDropdownOpen(false)
  };

  const toggleDropdown = () => {
    setIsDropdownOpen((prevState) => !prevState);
  };

  const DropdownMenu = () =>
    ReactDOM.createPortal(
      isDropdownOpen && (
        <div
          className="dropdown-menu"
          style={{
            position: 'fixed',
            top: '40px',
            right: '20px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
            zIndex: 9999,
          }}
        >
          <button
            onClick={handleLogout}
            className="dropdown-item"
            style={{
              padding: '10px',
              width: '100%',
              backgroundColor: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              color: '#333',
            }}
          >
            Logout
          </button>
        </div>
      ),
      document.body
    );

  return (
    <header className="header" style={{ zIndex: 5000 }}>
      <img src={sti_logo} alt="Logo" className="logo-image" />
      <nav className="nav-bar">
        <i className="fa-solid fa-house"></i> <a href="/">Home</a>
        <i className="fa-solid fa-tower-cell"></i><a href="/">Acquisitions</a>
        <i className="fa-solid fa-wallet"></i><a href="/">Origination</a>
        <i className="fa-brands fa-readme"></i><a href="/">Legal</a>
        <i className="fa-solid fa-icons"></i><a href="/">Marketing</a>
        <i className="fa-solid fa-user"></i><a href="/">Human Resources</a>
        <i className="fa-solid fa-laptop"></i><a href="/">Technology</a>
      </nav>
      <div className="user">
        {isAuthenticated && accounts[0] ? (
          <div className="user-dropdown" style={{ position: 'relative' }}>
            <span
              onClick={toggleDropdown}
              className="user-name"
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              Welcome, {accounts[0]?.name?.split(' ')[0]}!{' '}
              <i
                className={`fa-solid fa-caret-down ${
                  isDropdownOpen ? 'open' : ''
                }`}
                style={{ marginLeft: '5px' }}
              ></i>
            </span>
            <DropdownMenu />
          </div>
        ) : (
          <button onClick={handleLogin} className="login-button">
            Login
          </button>
        )}
      </div>
      {/* {showPopup && (
        <ImagePopup onClose={() => setShowPopup(false)} />
      )} */}
    </header>
  );
};

export default Header;