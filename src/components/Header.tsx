import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import '../../styles/header.css';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import { BYPASS_AUTH, loginRequest } from '../authConfig';
import sti_logo_white from '../../images/sti-horizontal-white.png'
import { UserInfo } from '../types/user';
import { useEditMode } from '../context/EditMenuContext';
import { DEPARTMENTS } from '../config/departments';

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

// Brave does not include "Brave" in its user-agent string (it looks identical to
// Chrome), but it does expose navigator.brave. We check this to:
//   1. Guarantee Brave on Android always takes the redirect path even if a future
//      Brave build adds an Edge-like token to its UA.
//   2. Catch Brave on tablet or non-standard Android builds that don't include
//      "android" in the UA but still run without Edge's native identity broker.
const isBrave = (): boolean => !!(navigator as any).brave;

// True for any Android browser that lacks Microsoft Edge's native auth broker
// integration, including Chrome, Brave, Samsung Internet, Firefox for Android, etc.
// On these browsers, Chrome Custom Tabs intercept the post-Authenticator redirect
// and open it in a new session instead of returning to the original tab, so we
// skip the popup entirely and use a full-page redirect instead.
const isAndroidNonEdge = (): boolean => {
  const ua = navigator.userAgent;
  const onAndroid = /android/i.test(ua);
  // Treat a browser as Edge only if the UA actually says so AND it is not Brave
  // (Brave is Chromium-based and could theoretically carry an Edge-style token).
  const isEdge = /edg(e|a)\//i.test(ua) && !isBrave();
  return (onAndroid || isBrave()) && !isEdge;
};

// Edge on iOS (EdgiOS) runs on WKWebView. WKWebView navigates popup windows to
// about:blank after a cross-origin redirect, so MSAL never receives the auth
// response from a loginPopup call. Skip popup entirely and use loginRedirect.
const isIOSEdge = (): boolean => /edgios/i.test(navigator.userAgent);

const Header: React.FC<HeaderProps> = ({ userInfo }) => {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const { isEditMode, toggleEditMode } = useEditMode();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDepartmentsOpen, setIsDepartmentsOpen] = useState(false);
  const [authBlockError, setAuthBlockError] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const departmentsRef = useRef<HTMLDivElement>(null);
  const departmentsMenuRef = useRef<HTMLDivElement>(null);
  const [departmentsMenuStyle, setDepartmentsMenuStyle] = useState<React.CSSProperties>({});

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

  const updateDepartmentsMenuPosition = useCallback(() => {
    const header = headerRef.current;
    const trigger = departmentsRef.current;
    if (!header || !trigger) return;

    const headerRect = header.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    setDepartmentsMenuStyle({
      position: 'fixed',
      top: `${headerRect.bottom}px`,
      left: `${triggerRect.left}px`,
      zIndex: 10000,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isDepartmentsOpen) return;
    updateDepartmentsMenuPosition();
  }, [isDepartmentsOpen, updateDepartmentsMenuPosition]);

  useEffect(() => {
    if (!isDepartmentsOpen) return;

    window.addEventListener('resize', updateDepartmentsMenuPosition);
    window.addEventListener('scroll', updateDepartmentsMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateDepartmentsMenuPosition);
      window.removeEventListener('scroll', updateDepartmentsMenuPosition, true);
    };
  }, [isDepartmentsOpen, updateDepartmentsMenuPosition]);

  useEffect(() => {
    if (!isDepartmentsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedTrigger = departmentsRef.current?.contains(target);
      const clickedMenu = departmentsMenuRef.current?.contains(target);
      if (!clickedTrigger && !clickedMenu) {
        setIsDepartmentsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDepartmentsOpen]);

  const handleLogin = async () => {
    setAuthBlockError(false);

    // On Android non-Edge: Chrome Custom Tabs intercept the Authenticator
    // redirect in a separate session, so the popup never returns.
    // On ALL iOS browsers (Safari, Edge, Chrome, etc.): Apple mandates WKWebView
    // for every third-party browser. WKWebView navigates popup windows to
    // about:blank after the cross-origin Microsoft redirect, so MSAL never
    // receives the auth response. Skip popup entirely for any iOS browser.
    if (isAndroidNonEdge() || isIOSEdge() || isMobileSafari()) {
      instance.loginRedirect(loginRequest).catch((e: any) => {
        if (isConditionalAccessError(e)) setAuthBlockError(true);
        else console.error(e);
      });
      return;
    }

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

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const handleLogout = async () => {
    closeDropdown();
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

  const toggleDepartments = () => {
    setIsDepartmentsOpen((prev) => !prev);
  };

  const closeDepartments = () => {
    setIsDepartmentsOpen(false);
  };

  const DepartmentsMenu = () =>
    ReactDOM.createPortal(
      isDepartmentsOpen && (
        <div
          ref={departmentsMenuRef}
          className="nav-dropdown-menu"
          role="menu"
          style={departmentsMenuStyle}
        >
          {/*
            Department navigation disabled — restore Link when pages are ready:
            <Link to={item.path} className="nav-dropdown-item" role="menuitem" onClick={closeDepartments}>…</Link>
          */}
          {DEPARTMENTS.map((item) => (
            <span
              key={item.path}
              className="nav-dropdown-item nav-dropdown-item-disabled"
              role="menuitem"
              aria-disabled="true"
            >
              <i className={item.icon} aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>
      ),
      document.body
    );

  const DropdownMenu = () =>
    ReactDOM.createPortal(
      isDropdownOpen && (
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
    <header ref={headerRef} className="header" style={{ zIndex: 5000 }}>
      <img src={sti_logo_white} alt="Logo" className="logo-image" />
      <nav className="nav-bar">
        <i className="fa-solid fa-house"></i> <Link to="/">Home</Link>
        {userInfo.isAuthenticated && (
          <>
            <i className="fa-solid fa-users"></i> <Link to="/directory">Directory</Link>
            <i className="fa-solid fa-chart-bar"></i> <Link to="/reports">Reports</Link>
            <i className="fa-solid fa-tower-cell"></i> <Link to="/lead-generation">Lead Generation</Link>
            <div className="nav-dropdown" ref={departmentsRef}>
              <button
                type="button"
                className={`nav-dropdown-trigger${isDepartmentsOpen ? ' open' : ''}`}
                onClick={toggleDepartments}
                aria-expanded={isDepartmentsOpen}
                aria-haspopup="true"
              >
                <i className="fa-solid fa-building" aria-hidden="true" />
                <span className="nav-dropdown-label">
                  Departments
                  <span
                    className={`nav-dropdown-caret${isDepartmentsOpen ? ' open' : ''}`}
                    aria-hidden="true"
                  >
                    ▼
                  </span>
                </span>
              </button>
            </div>
          </>
        )}
      </nav>
      <DepartmentsMenu />
      <div className="user">
        {(isAuthenticated && accounts[0]) || (BYPASS_AUTH && userInfo.isAuthenticated) ? (
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
            <DropdownMenu />
          </div>
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