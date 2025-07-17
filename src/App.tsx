import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import Header from './components/Header';
import HomePage from './components/HomePage';
import HRPage from './components/HRPage';
import ITPage from './components/ITPage';
import TechnologyReports from './components/Reports';
import { loginRequest, isEliteGroupMember } from './authConfig';
import { UserInfo } from './types/user';
import { getGroupIds } from './utils/getGroupId';

const App: React.FC = () => {
  const { instance } = useMsal();
  const [userInfo, setUserInfo] = useState<UserInfo>({
    isAuthenticated: false,
    isEliteGroup: false,
  });

  const checkAuthentication = async () => {
    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      const account = accounts[0];
      const email = account.username || account.homeAccountId;
      
      // Check group membership asynchronously
      let isElite = false;
      try {
        isElite = await isEliteGroupMember(instance);
      } catch (error) {
        console.error('Error checking elite group membership:', error);
        isElite = false;
      }
      
      setUserInfo({
        isAuthenticated: true,
        isEliteGroup: isElite,
        email: email,
        name: account.name,
      });
    } else {
      setUserInfo({
        isAuthenticated: false,
        isEliteGroup: false,
      });
    }
  };

  useEffect(() => {
    // Check authentication status on app load
    checkAuthentication();

    // Listen to MSAL events for account changes
    const callbackId = instance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS) {
        console.log('Login successful, updating state.');
        checkAuthentication();
      }

      if (event.eventType === EventType.LOGOUT_SUCCESS) {
        console.log('Logout successful, updating state.');
        checkAuthentication();
      }

      if (event.eventType === EventType.ACCOUNT_ADDED || event.eventType === EventType.ACCOUNT_REMOVED) {
        console.log('Account state changed, updating state.');
        checkAuthentication();
      }
    });

    return () => {
      // Clean up event listener
      if (callbackId) {
        instance.removeEventCallback(callbackId);
      }
    };
  }, [instance]);

  // Temporary debug function - remove after getting the group ID
  useEffect(() => {
    if (userInfo.isAuthenticated) {
      // Add this to window for debugging
      (window as any).debugGroups = () => getGroupIds(instance);
      console.log('🔍 To find your group ID, run: window.debugGroups() in the console');
    }
  }, [userInfo.isAuthenticated, instance]);

  return (
    <Router>
      <Header userInfo={userInfo} />
      <div className="main-content">
        <Routes>
          <Route
            path="/"
            element={<HomePage userInfo={userInfo} />}
          />
          {userInfo.isAuthenticated && (
            <>
              {/* <Route path="/hr" element={<HRPage />} />
              <Route path="/it" element={<ITPage />} /> */}
              <Route path="/technology" element={<TechnologyReports userInfo={userInfo} />} />
              {/* <Route path="/reports" element={<TechnologyReports />} /> */}
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
};

export default App;