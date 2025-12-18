import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import '../../styles/header.css';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from '../authConfig';
import sti_logo_white from '../../images/sti-horizontal-white.png';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './common/Button';

const Header: React.FC = () => {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const { userInfo } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch((error: Error) => {
      console.error('Login error:', error);
    });
  };

  const handleLogout = () => {
    instance.logoutPopup().catch((error: Error) => {
      console.error('Logout error:', error);
    });
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen((prevState) => !prevState);
  };

  const DropdownMenu = () => {
    if (!isDropdownOpen) return null;

    return createPortal(
      <div
        ref={dropdownRef}
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
      </div>,
      document.body
    );
  };

  return (
    <header className="header" style={{ zIndex: 5000 }}>
      <img src={sti_logo_white} alt="Logo" className="logo-image" />
      <nav className="nav-bar">
        <i className="fa-solid fa-house"></i> <Link to="/">Home</Link>
        <i className="fa-solid fa-tech"></i><Link to="/technology">Technology</Link>
        <i className="fa-solid fa-tower-cell"></i><Link to="/acquisitions">Acquisitions</Link>
        <i className="fa-solid fa-wallet"></i><Link to="/origination">Origination</Link>
        <i className="fa-brands fa-readme"></i><Link to="/legal">Legal</Link>
        <i className="fa-solid fa-icons"></i><Link to="/marketing">Marketing</Link>
        <i className="fa-solid fa-user"></i><Link to="/hr">Human Resources</Link>
        <i className="fa-solid fa-laptop"></i><Link to="/reports">Reports</Link>
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
          <Button onClick={handleLogin} variant="primary">
            Login
          </Button>
        )}
      </div>
    </header>
  );
};

export default Header;