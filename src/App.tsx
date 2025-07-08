import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import Header from './components/Header';
import HomePage from './components/HomePage';
import HRPage from './components/HRPage';
import ITPage from './components/ITPage';
import Reports from './components/Reports';
import Acquisitions from './components/Acquisitions';
import { loginRequest } from './authConfig';

const App: React.FC = () => {
  const { instance } = useMsal();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuthentication = () => {
    const accounts = instance.getAllAccounts();
    setIsAuthenticated(accounts.length > 0);
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
      <Header />
      <div className="main-content">
        <Routes>
          <Route
            path="/"
            element={<HomePage isAuthenticated={isAuthenticated} />}
          />
          <Route path="/acquisitions" element={<Acquisitions />} />
          <Route path="/hr" element={<HRPage />} />
          {/* <Route path="/it" element={<ITPage />} /> */}
          {/* <Route path="/origination" element={<HRPage />} />
          <Route path="/acqusitions" element={<ITPage />} /> */}
          {/* <Route path="/legal" element={<HRPage />} />
          <Route path="/marketing" element={<ITPage />} /> */}
          <Route path="/s" element={<Reports />} />
          {/* <Route path="/s" element={<Technologys />} /> */}
        </Routes>
      </div>
    </Router>
  );
};

export default App;