import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import Header from './components/Header';
import HomePage from './components/HomePage';
import ITPage from './components/ITPage';
import Reports from './components/Reports';
import LeadGeneration from './components/LeadGeneration';
import { isEliteGroupMember } from './authConfig';
import { UserInfo } from './types/user';

/** Bumped when elite detection logic changes so clients re-fetch instead of using stale false. */
const eliteStatusKey = (email: string) => `elite_status_v2_${email}`;
const eliteStatusTsKey = (email: string) => `elite_status_timestamp_v2_${email}`;

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

      const cachedEliteStatus = localStorage.getItem(eliteStatusKey(email));
      const cachedTimestamp = localStorage.getItem(eliteStatusTsKey(email));
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

        // isEliteGroupMember returns false on transient errors (no throw), so retry
        // on false until success or attempts exhausted—otherwise elite users often
        // cache false on the first token/Graph timing failure.
        const maxRetries = 5;
        const retryDelays = [1000, 2000, 3000, 5000, 8000];
        let attempt = 0;
        while (attempt < maxRetries) {
          isElite = await isEliteGroupMember(instance);
          if (isElite) break;
          attempt++;
          if (attempt < maxRetries) {
            await new Promise(resolve =>
              setTimeout(resolve, retryDelays[attempt - 1] ?? 8000)
            );
          }
        }

        localStorage.setItem(eliteStatusKey(email), isElite.toString());
        localStorage.setItem(eliteStatusTsKey(email), Date.now().toString());
        setUserInfo(prev => ({ ...prev, isEliteGroup: isElite }));
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
              localStorage.setItem(eliteStatusKey(email), 'true');
              localStorage.setItem(eliteStatusTsKey(email), Date.now().toString());
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
  return (
    <>
      <Header userInfo={userInfo} />
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
