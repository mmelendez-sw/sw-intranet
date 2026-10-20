import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  isNewVersionAvailable,
  VERSION_CHECK_ENABLED,
  VERSION_CHECK_INTERVAL_MS,
} from '../utils/versionCheck';

/**
 * Polls /version.json (every 5 min and on focus). When a newer deploy is live it shows a
 * full-width refresh bar under the header, and the next in-app navigation does a full load
 * instead — never a surprise reload that could drop an open form or edit.
 */
const UpdateAvailableBanner: React.FC = () => {
  const location = useLocation();
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const updateReadyRef = useRef(false);
  const lastPathRef = useRef(location.pathname);

  useEffect(() => {
    if (!VERSION_CHECK_ENABLED) return;
    let checking = false;
    const check = async () => {
      if (checking || updateReadyRef.current) return;
      checking = true;
      try {
        if (await isNewVersionAvailable()) {
          updateReadyRef.current = true;
          setUpdateReady(true);
        }
      } finally {
        checking = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const intervalId = window.setInterval(() => void check(), VERSION_CHECK_INTERVAL_MS);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Route change after an update was detected → load the new build at the new URL.
  useEffect(() => {
    if (location.pathname === lastPathRef.current) return;
    lastPathRef.current = location.pathname;
    if (updateReadyRef.current) window.location.reload();
  }, [location.pathname]);

  // Sit just under the header: fixed on desktop, scrolls away on touch/mobile layouts.
  const [top, setTop] = useState(0);
  useLayoutEffect(() => {
    if (!updateReady || dismissed) return;
    const place = () => {
      const header = document.querySelector('.header');
      setTop(header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 0);
    };
    place();
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, [updateReady, dismissed, location.pathname]);

  if (!updateReady || dismissed) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top,
        left: 0,
        right: 0,
        // Under the header (5000) so its dropdown menus still open over the bar.
        zIndex: 4999,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px 18px',
        padding: '14px 48px 14px 16px',
        background: '#ffc845',
        color: '#003366',
        borderBottom: '3px solid #e0a800',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        fontFamily: "'Barlow', sans-serif",
        fontSize: 18,
        fontWeight: 600,
        textAlign: 'center',
      }}
    >
      <span>A new version of the intranet is available.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: '#003366',
          color: '#fff',
          border: 0,
          borderRadius: 6,
          padding: '10px 22px',
          cursor: 'pointer',
          fontSize: 17,
          fontWeight: 700,
        }}
      >
        Refresh now
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          color: '#003366',
          border: 0,
          cursor: 'pointer',
          fontSize: 28,
          lineHeight: 1,
        }}
      >
        &times;
      </button>
    </div>
  );
};

export default UpdateAvailableBanner;
