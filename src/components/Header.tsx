import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import '../../styles/header.css';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import { BYPASS_AUTH, isDevPreviewAllowlisted, isIcemanAllowlisted } from '../authConfig';
import sti_logo_white from '../../images/optimized/sti-horizontal-white.png'
import { UserInfo } from '../types/user';
import { useEditMode } from '../context/EditMenuContext';
import { useTheme } from '../context/ThemeContext';
import HeaderSearch from './HeaderSearch';
import { clearUserSessionState } from '../utils/signOutCleanup';
import { isAndroidNonEdge, isConditionalAccessError, isMobileSafari, startLogin } from '../utils/login';

interface HeaderProps {
  userInfo: UserInfo;
}

// Build a deep-link URL that opens the current page directly in Edge on iOS/Android.
// Format: microsoft-edge-https://host/path
const getEdgeDeepLink = (): string => {
  const { hostname, pathname, search } = window.location;
  return `microsoft-edge-https://${hostname}${pathname}${search}`;
};

const Header: React.FC<HeaderProps> = ({ userInfo }) => {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const { isEditMode, toggleEditMode } = useEditMode();
  const { theme, canToggle: canToggleTheme, toggleTheme } = useTheme();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [authBlockError, setAuthBlockError] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Login runs from here and the welcome page (startLogin); MSAL reports both popup and
  // redirect outcomes as events, so the Conditional Access banner follows either button.
  useEffect(() => {
    const callbackId = instance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_START) {
        setAuthBlockError(false);
      } else if (event.eventType === EventType.LOGIN_FAILURE && isConditionalAccessError(event.error)) {
        setAuthBlockError(true);
      }
    });
    return () => {
      if (callbackId) instance.removeEventCallback(callbackId);
    };
  }, [instance]);

  const handleLogin = () => void startLogin(instance);

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const handleLogout = async () => {
    closeDropdown();
    try {
      await instance.logoutPopup();
    } catch (e: any) {
      if (e.errorCode === 'popup_window_error' || e.errorCode === 'empty_window_error') {
        // Redirect logout navigates away (full reload), so clear user state first.
        clearUserSessionState(userInfo.email);
        instance.logoutRedirect().catch(console.error);
      } else {
        console.error(e);
      }
      return;
    }
    // Full reload so module-level caches, edit mode, and per-user widgets don't carry over
    // to whoever signs in next on this tab.
    clearUserSessionState(userInfo.email);
    window.location.assign('/');
  };

  const toggleDropdown = () => {
    setIsDropdownOpen((prevState) => !prevState);
  };

  // Rendered inline (not as a component defined inside render): a nested component type is
  // new on every Header render, which unmounted and remounted the portal each time.
  const dropdownMenu = isDropdownOpen
    ? ReactDOM.createPortal(
        <div
          className="dropdown-menu"
          style={{
            position: 'fixed',
            top: '40px',
            right: '20px',
            minWidth: '180px',
            zIndex: 9999,
          }}
        >
          {userInfo.isEditor && (
            <button
              type="button"
              onClick={() => {
                toggleEditMode();
                closeDropdown();
              }}
              className={`dropdown-item dropdown-edit-toggle${isEditMode ? ' active' : ''}`}
              aria-pressed={isEditMode}
            >
              ✏ Edit{isEditMode ? ' (on)' : ''}
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="dropdown-item"
          >
            Logout
          </button>
        </div>,
        document.body
      )
    : null;

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
    <header ref={headerRef} className="header" style={{ zIndex: 5000 }}>
      <img src={sti_logo_white} alt="Logo" className="logo-image" />
      <nav className="nav-bar">
        <i className="fa-solid fa-house"></i> <Link to="/">Home</Link>
        {userInfo.isAuthenticated && (
          <>
            <i className="fa-solid fa-users"></i> <Link to="/directory">Directory</Link>
            <i className="fa-solid fa-chart-bar"></i> <Link to="/reports">Reports</Link>
            <i className="fa-solid fa-tower-cell"></i> <Link to="/lead-generation">Lead Generation</Link>
            {isIcemanAllowlisted(userInfo.email) && (
              <>
                <i className="fa-solid fa-satellite"></i> <Link to="/iceman">ICEMAN</Link>
              </>
            )}
            {isDevPreviewAllowlisted(userInfo.email) && (
              <>
                <i className="fa-solid fa-keyboard"></i> <Link to="/dev">Dev</Link>
              </>
            )}
            {/* Departments dropdown removed with the department pages (see git history for the
                portal menu + DEPARTMENTS config if they come back). */}
          </>
        )}
      </nav>
      <div className="user">
        {(isAuthenticated && accounts[0]) || (BYPASS_AUTH && userInfo.isAuthenticated) ? (
          <>
          <HeaderSearch userInfo={userInfo} />
          {canToggleTheme && (
            <button
              type="button"
              role="switch"
              aria-checked={theme === 'dark'}
              aria-label="Dark mode"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`theme-toggle${theme === 'dark' ? ' is-dark' : ''}`}
              onClick={toggleTheme}
            >
              <span className="theme-toggle-track" aria-hidden="true">
                <span className="theme-toggle-thumb">{theme === 'dark' ? '🌙' : '☀'}</span>
              </span>
            </button>
          )}
          <div className="user-dropdown">
            <span
              onClick={toggleDropdown}
              className="user-name"
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              Welcome, {(BYPASS_AUTH ? userInfo.name : accounts[0]?.name)?.split(' ')[0]}!
              {userInfo.isEliteGroup && (
                <span
                  style={{
                    fontSize: '0.8em',
                    color: '#e6f4ff',
                    marginLeft: '8px',
                    fontStyle: 'italic',
                    fontWeight: 600,
                    textShadow: '0 0 1px rgba(0,0,0,0.35)',
                  }}
                >
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
            {dropdownMenu}
          </div>
          </>
        ) : (
          <button onClick={handleLogin} className="login-button">
            Login
          </button>
        )}
      </div>
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

      {/* Proactive hint shown to iOS Safari users before they attempt login */}
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

      {/* Proactive hint shown to Android non-Edge users before they attempt login */}
      {!authBlockError && !isAuthenticated && isAndroidNonEdge() && (
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