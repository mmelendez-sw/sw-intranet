import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  isNewVersionAvailable,
  VERSION_CHECK_ENABLED,
  VERSION_CHECK_INTERVAL_MS,
} from '../utils/versionCheck';

/**
 * Polls /version.json (every 5 min and on focus). When a newer deploy is live it shows a
 * small refresh prompt, and the next in-app navigation does a full load instead — never a
 * surprise reload that could drop an open form or edit.
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

  if (!updateReady || dismissed) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 14px',
        background: '#003366',
        color: '#fff',
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        fontSize: 14,
      }}
    >
      <span>New version available</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{ background: '#fff', color: '#003366', border: 0, borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{ background: 'transparent', color: '#fff', border: 0, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
      >
        &times;
      </button>
    </div>
  );
};

export default UpdateAvailableBanner;
