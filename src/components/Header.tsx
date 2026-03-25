import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import '../../styles/header.css';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import { loginRequest } from '../authConfig';
import sti_logo_white from '../../images/sti-horizontal-white.png'
import { UserInfo } from '../types/user';
// import ImagePopup from './ImagePopup';

interface HeaderProps {
  userInfo: UserInfo;
}

// Returns true when an MSAL/AAD error is a Conditional Access block (e.g. the
// tenant requires Edge or device enrollment).
const isConditionalAccessError = (error: any): boolean => {
  if (!error) return false;
  const msg = ((error.errorMessage || error.message) ?? '').toLowerCase();
  const code = (error.errorCode ?? '').toLowerCase();
  return (
    msg.includes('aadsts53003') ||
    msg.includes('aadsts530003') ||
    msg.includes('conditional access') ||
    msg.includes('microsoft edge') ||
    msg.includes('approved client app') ||
    msg.includes('app protection policy') ||
    (code === 'access_denied' && (msg.includes('policy') || msg.includes('compliance') || msg.includes('device')))
  );
};

// Build a deep-link URL that opens the current page directly in Edge on iOS/Android.
// Format: microsoft-edge-https://host/path
const getEdgeDeepLink = (): string => {
  const { hostname, pathname, search } = window.location;
  return `microsoft-edge-https://${hostname}${pathname}${search}`;
};

const isMobileSafari = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  /safari/i.test(navigator.userAgent) &&
  !/chrome|crios|fxios|edgios/i.test(navigator.userAgent);

const Header: React.FC<HeaderProps> = ({ userInfo }) => {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [authBlockError, setAuthBlockError] = useState(false);
  // const [showPopup, setShowPopup] = useState(false);

  // Listen for redirect-based auth failures (e.g. CA block on the redirect flow).
  useEffect(() => {
    const callbackId = instance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_FAILURE && isConditionalAccessError(event.error)) {
        setAuthBlockError(true);
      }
    });
    return () => {
      if (callbackId) instance.removeEventCallback(callbackId);
    };
  }, [instance]);

  const handleLogin = async () => {
    setAuthBlockError(false);
    try {
      await instance.loginPopup(loginRequest);
    } catch (e: any) {
      if (isConditionalAccessError(e)) {
        setAuthBlockError(true);
        return;
      }
      // On mobile browsers (iOS Safari, in-app browsers) popups are often
      // blocked or get stuck when Authenticator is involved. Fall back to a
      // full-page redirect so the user can still authenticate.
      if (e.errorCode === 'popup_window_error' || e.errorCode === 'empty_window_error') {
        instance.loginRedirect(loginRequest).catch(console.error);
      } else {
        console.error(e);
      }
    }
  };

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    try {
      await instance.logoutPopup();
    } catch (e: any) {
      if (e.errorCode === 'popup_window_error' || e.errorCode === 'empty_window_error') {
        instance.logoutRedirect().catch(console.error);
      } else {
        console.error(e);
      }
    }
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

  const bannerStyle: React.CSSProperties = {
    gridColumn: '1 / -1',
    margin: '5px -10px -5px',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    fontSize: '13px',
    lineHeight: 1.4,
  };

  return (
    <header className="header" style={{ zIndex: 5000 }}>
      <img src={sti_logo_white} alt="Logo" className="logo-image" />
      <nav className="nav-bar">
        <i className="fa-solid fa-house"></i> <Link to="/">Home</Link>
        {userInfo.isAuthenticated && (
          <><i className="fa-solid fa-tower-cell"></i> <Link to="/lead-generation">Lead Generation</Link></>
        )}
        {/* <i className="fa-solid fa-tech"></i><Link to="/technology">Technology</Link>
        <i className="fa-solid fa-tower-cell"></i><Link to="/acquisitions">Acquisitions</Link>
        <i className="fa-solid fa-wallet"></i><Link to="/origination">Origination</Link>
        <i className="fa-brands fa-readme"></i><Link to="/legal">Legal</Link>
        <i className="fa-solid fa-icons"></i><Link to="/marketing">Marketing</Link>
        <i className="fa-solid fa-user"></i><Link to="/hr">Human Resources</Link>
        <i className="fa-solid fa-laptop"></i><Link to="/reports">Reports</Link> */}
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

      {/* Shown after a Conditional Access policy explicitly blocks sign-in */}
      {authBlockError && (
        <div
          style={{
            ...bannerStyle,
            backgroundColor: '#fff3cd',
            borderTop: '1px solid #ffa500',
            color: '#5c3d00',
          }}
          role="alert"
        >
          <i className="fa-solid fa-triangle-exclamation" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong>Sign-in blocked by your organization's security policy.</strong>
            {' '}Your device may need to be enrolled in Intune, or your organization requires Microsoft Edge on mobile.
            {' '}
            <a
              href={getEdgeDeepLink()}
              style={{ color: '#0d6efd', fontWeight: 600 }}
            >
              Open this page in Microsoft Edge
            </a>
            {' '}or contact your IT administrator.
          </div>
          <button
            onClick={() => setAuthBlockError(false)}
            aria-label="Dismiss"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#5c3d00',
              fontSize: '20px',
              lineHeight: 1,
              flexShrink: 0,
              padding: '0 0 0 8px',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Proactive hint shown to mobile Safari users before they attempt login */}
      {!authBlockError && !isAuthenticated && isMobileSafari() && (
        <div
          style={{
            ...bannerStyle,
            backgroundColor: '#e8f4fd',
            borderTop: '1px solid #90c8ff',
            color: '#0a4d8b',
          }}
        >
          <i className="fa-solid fa-circle-info" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Having trouble signing in? Your organization may require{' '}
            <a href={getEdgeDeepLink()} style={{ color: '#0d6efd', fontWeight: 600 }}>
              Microsoft Edge
            </a>
            {' '}on mobile devices.
          </span>
        </div>
      )}
    </header>
  );
};

export default Header;