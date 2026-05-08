import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import Header from './components/Header';
import HomePage from './components/HomePage';
import ITPage from './components/ITPage';
import Reports from './components/Reports';
import LeadGeneration from './components/LeadGeneration';
import { UserInfo } from './types/user';

const eliteReportsEmailAllowlist = new Set([
  'arivera@symphonyinfra.com',
  'bgoyal@symphonyinfra.com',
  'cdolgon@symphonyinfra.com',
  'gthomas1@symphonyinfra.com',
  'htolani@symphonyinfra.com',
  'izheng@symphonyinfra.com',
  'jhirsch@symphonyinfra.com',
  'jcymbalista@symphonyinfra.com',
  'mmelendez@symphonyinfra.com',
  'pmuthu@symphonyinfra.com',
  'vasmar@symphonyinfra.com',
  'vazemar@symphonyinfra.com',
]);

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
      const normalizedEmail = email?.trim().toLowerCase();
      const isElite = normalizedEmail ? eliteReportsEmailAllowlist.has(normalizedEmail) : false;

      setUserInfo({
        isAuthenticated: true,
        isEliteGroup: isElite,
        email,
        name: account.name,
      });
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
