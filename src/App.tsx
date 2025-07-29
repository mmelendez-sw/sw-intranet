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
      
      console.log('🔍 Checking authentication for:', email);
      
      // Check if we have cached elite status for this user
      const cachedEliteStatus = localStorage.getItem(`elite_status_${email}`);
      const cachedTimestamp = localStorage.getItem(`elite_status_timestamp_${email}`);
      let isElite = false;
      
      // Check if cache is still valid (24 hours)
      const cacheValid = cachedTimestamp && (Date.now() - parseInt(cachedTimestamp)) < (24 * 60 * 60 * 1000);
      
      console.log('🔍 Cache check:', { 
        cachedEliteStatus, 
        cachedTimestamp, 
        cacheValid, 
        currentTime: Date.now(),
        cacheAge: cachedTimestamp ? Date.now() - parseInt(cachedTimestamp) : 'N/A'
      });
      
      if (cachedEliteStatus && cacheValid) {
        isElite = cachedEliteStatus === 'true';
        console.log('🔍 Using cached elite status:', isElite);
        
        // Set user info immediately with cached elite status
        setUserInfo({
          isAuthenticated: true,
          isEliteGroup: isElite,
          email: email,
          name: account.name,
        });
      } else {
        console.log('🔍 Cache invalid or missing, checking group membership...');
        
        // Set user as authenticated immediately but with elite status pending
        setUserInfo({
          isAuthenticated: true,
          isEliteGroup: false, // Will be updated once we get the real status
          email: email,
          name: account.name,
        });
        
        // Wait a bit to ensure MSAL is fully initialized
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check group membership asynchronously with improved retry logic
        let retryCount = 0;
        const maxRetries = 5; // Increased retries
        const retryDelays = [1000, 2000, 3000, 5000, 8000]; // Progressive delays
        
        while (retryCount < maxRetries) {
          try {
            console.log('🔍 Checking elite group membership (attempt', retryCount + 1, ')...');
            isElite = await isEliteGroupMember(instance);
            console.log('🔍 Elite group membership result:', isElite);
            
            // Cache the result with timestamp
            localStorage.setItem(`elite_status_${email}`, isElite.toString());
            localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
            console.log('🔍 Cached elite status:', isElite);
            
            // Update user info with the correct elite status
            setUserInfo(prev => ({
              ...prev,
              isEliteGroup: isElite
            }));
            
            break; // Success, exit retry loop
          } catch (error) {
            console.error('❌ Error checking elite group membership (attempt', retryCount + 1, '):', error);
            retryCount++;
            if (retryCount < maxRetries) {
              const delay = retryDelays[retryCount - 1] || 8000;
              console.log(`🔍 Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              console.log('🔍 Max retries reached, defaulting to non-elite');
              isElite = false;
              // Cache the fallback result
              localStorage.setItem(`elite_status_${email}`, 'false');
              localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
              
              // Update user info with fallback elite status
              setUserInfo(prev => ({
                ...prev,
                isEliteGroup: false
              }));
            }
          }
        }
        
        console.log('🔍 Final elite status:', isElite);
        console.log('🔍 Setting user info:', { isAuthenticated: true, isEliteGroup: isElite, email, name: account.name });
      }
    } else {
      console.log('🔍 No accounts found, setting unauthenticated state');
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