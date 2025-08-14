import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { createPortal } from 'react-dom';
import sti_logo_white from '../../images/symph_white_t.png';

interface HeaderProps {
  userInfo: {
    isAuthenticated: boolean;
    isEliteGroup: boolean;
    hasPowerBILicense?: boolean;
  };
}

const Header: React.FC<HeaderProps> = ({ userInfo }) => {
  const { instance, accounts } = useMsal();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const isAuthenticated = userInfo.isAuthenticated;

  const handleLogin = () => {
    instance.loginPopup();
  };

  const handleLogout = () => {
    instance.logoutPopup();
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const DropdownMenu = () =>
    createPortal(
      <div
        style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          backgroundColor: 'white',
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
      </div>,
      document.body
    );

  return (
    <header className="header" style={{ zIndex: 5000 }}>
      <img src={sti_logo_white} alt="Logo" className="logo-image" />
      <nav className="nav-bar">
        <i className="fa-solid fa-house"></i> <Link to="/">Home</Link>
        <i className="fa-solid fa-tech"></i><Link to="/ITPage">Technology</Link>
        <i className="fa-solid fa-tower-cell"></i><Link to="/acquisitions">Acquisitions</Link>
        <i className="fa-solid fa-wallet"></i><Link to="/origination">Origination</Link>
        <i className="fa-brands fa-readme"></i><Link to="/legal">Legal</Link>
        <i className="fa-solid fa-icons"></i><Link to="/marketing">Marketing</Link>
        <i className="fa-solid fa-user"></i><Link to="/hr">Human Resources</Link>
        <i className="fa-solid fa-laptop"></i><Link to="/reports">Reports</Link>
        {/* <button 
          className="test-popup-button"
          onClick={() => setShowPopup(true)}
        >
          Test Popup
        </button> */}
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
              Welcome, {accounts[0]?.name?.split(' ')[0]}!
              {userInfo.isEliteGroup && (
                <span style={{ 
                  fontSize: '0.8em', 
                  color: '#666', 
                  marginLeft: '5px',
                  fontStyle: 'italic'
                }}>
                  (Elite)
                </span>
              )}
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