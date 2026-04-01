import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import Header from './components/Header';
import HomePage from './components/HomePage';
import ITPage from './components/ITPage';
import Reports from './components/Reports';
import LeadGeneration from './components/LeadGeneration';
import { isEliteGroupMember } from './authConfig';
import { UserInfo } from './types/user';

const App: React.FC = () => {
  const { instance } = useMsal();
  const hasSignedInAccount = instance.getAllAccounts().length > 0;
  const [userInfo, setUserInfo] = useState<UserInfo>({
    isAuthenticated: false,
    isEliteGroup: false,
  });

  const checkAuthentication = async () => {
    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      const account = accounts[0];
      const email = account.username || account.homeAccountId;

      const cachedEliteStatus = localStorage.getItem(`elite_status_${email}`);
      const cachedTimestamp = localStorage.getItem(`elite_status_timestamp_${email}`);
      let isElite = false;

      const cacheValid = cachedTimestamp && (Date.now() - parseInt(cachedTimestamp)) < (24 * 60 * 60 * 1000);

      if (cachedEliteStatus && cacheValid) {
        isElite = cachedEliteStatus === 'true';
        setUserInfo({
          isAuthenticated: true,
          isEliteGroup: isElite,
          email,
          name: account.name,
        });
      } else {
        setUserInfo({
          isAuthenticated: true,
          isEliteGroup: false,
          email,
          name: account.name,
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        let retryCount = 0;
        const maxRetries = 5;
        const retryDelays = [1000, 2000, 3000, 5000, 8000];

        while (retryCount < maxRetries) {
          try {
            isElite = await isEliteGroupMember(instance);

            localStorage.setItem(`elite_status_${email}`, isElite.toString());
            localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());

            setUserInfo(prev => ({ ...prev, isEliteGroup: isElite }));
            break;
          } catch (error) {
            retryCount++;
            if (retryCount < maxRetries) {
              const delay = retryDelays[retryCount - 1] || 8000;
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              localStorage.setItem(`elite_status_${email}`, 'false');
              localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
              setUserInfo(prev => ({ ...prev, isEliteGroup: false }));
            }
          }
        }
      }
    } else {
      setUserInfo({ isAuthenticated: false, isEliteGroup: false });
    }
  };

  useEffect(() => {
    checkAuthentication();

    const callbackId = instance.addEventCallback((event) => {
      if (
        event.eventType === EventType.LOGIN_SUCCESS ||
        event.eventType === EventType.LOGOUT_SUCCESS ||
        event.eventType === EventType.ACCOUNT_ADDED ||
        event.eventType === EventType.ACCOUNT_REMOVED
      ) {
        checkAuthentication();
      }
    });

    return () => {
      if (callbackId) instance.removeEventCallback(callbackId);
    };
  }, [instance]);

  useEffect(() => {
    const initializeEliteCheck = async () => {
      const accounts = instance.getAllAccounts();
      if (accounts.length === 0) return;

      const account = accounts[0];
      const email = account.username || account.homeAccountId;

      const cachedEliteStatus = localStorage.getItem(`elite_status_${email}`);
      const cachedTimestamp = localStorage.getItem(`elite_status_timestamp_${email}`);
      const cacheValid = cachedTimestamp && (Date.now() - parseInt(cachedTimestamp)) < (24 * 60 * 60 * 1000);

      if (cachedEliteStatus && cacheValid) {
        setUserInfo(prev => ({
          ...prev,
          isAuthenticated: true,
          isEliteGroup: cachedEliteStatus === 'true',
          email,
          name: account.name,
        }));
      } else {
        try {
          const isElite = await isEliteGroupMember(instance);
          localStorage.setItem(`elite_status_${email}`, isElite.toString());
          localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
          setUserInfo(prev => ({ ...prev, isAuthenticated: true, isEliteGroup: isElite, email, name: account.name }));
        } catch {
          // Falls through to main checkAuthentication retry flow
        }
      }
    };

    initializeEliteCheck();
  }, [instance]);

  useEffect(() => {
    if (!userInfo.isAuthenticated || userInfo.isEliteGroup) return;

    const persistentCheck = async () => {
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts && userInfo.isAuthenticated && !userInfo.isEliteGroup) {
        attempts++;
        try {
          const isElite = await isEliteGroupMember(instance);
          if (isElite) {
            const accounts = instance.getAllAccounts();
            if (accounts.length > 0) {
              const email = accounts[0].username || accounts[0].homeAccountId;
              localStorage.setItem(`elite_status_${email}`, 'true');
              localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
              setUserInfo(prev => ({ ...prev, isEliteGroup: true }));
              break;
            }
          }
        } catch {
          // Continue retrying
        }
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * attempts, 8000)));
      }
    };

    checkAuthentication();
    persistentCheck();
  }, [userInfo.isAuthenticated, userInfo.isEliteGroup, instance]);

  return (
    <Router>
      <AppContent userInfo={userInfo} hasSignedInAccount={hasSignedInAccount} />
    </Router>
  );
};

const AppContent: React.FC<{ userInfo: UserInfo; hasSignedInAccount: boolean }> = ({ userInfo, hasSignedInAccount }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <>
      {!isHomePage && <Header userInfo={userInfo} />}
      <div className="main-content">
        <Routes>
          <Route path="/" element={<HomePage userInfo={userInfo} />} />
          <Route
            path="/lead-generation"
            element={userInfo.isAuthenticated || hasSignedInAccount ? <LeadGeneration userInfo={userInfo} /> : <Navigate to="/" replace />}
          />
          {userInfo.isAuthenticated && (
            <>
              <Route path="/technology" element={<ITPage />} />
              <Route path="/reports" element={<Reports userInfo={userInfo} />} />
              <Route path="/acquisitions" element={<div>Acquisitions Page - Coming Soon</div>} />
              <Route path="/origination" element={<div>Origination Page - Coming Soon</div>} />
              <Route path="/legal" element={<div>Legal Page - Coming Soon</div>} />
              <Route path="/marketing" element={<div>Marketing Page - Coming Soon</div>} />
              <Route path="/hr" element={<div>Human Resources Page - Coming Soon</div>} />
            </>
          )}
        </Routes>
      </div>
    </>
  );
};

export default App;
