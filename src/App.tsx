import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import Header from './components/Header';
import HomePage from './components/HomePage';
import HRPage from './components/HRPage';
import ITPage from './components/ITPage';
import { loginRequest } from './authConfig';

const App: React.FC = () => {
  const { instance } = useMsal();
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuthentication = () => {
    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    // Attempt silent SSO on app load
    instance
      .ssoSilent({
        scopes: loginRequest.scopes,
      })
      .then(() => {
        console.log('Silent SSO successful.');
        checkAuthentication();
        setIsAuthInitialized(true); // Auth initialization complete
      })
      .catch((error) => {
        console.error('Silent SSO failed:', error);

        if (error.name === 'InteractionRequiredAuthError') {
          console.log('Fallback to interactive login required.');
          instance
            .loginPopup(loginRequest)
            .then(() => {
              console.log('Interactive login successful.');
              checkAuthentication();
              setIsAuthInitialized(true); // Auth initialization complete
            })
            .catch((err) => {
              console.error('Interactive login failed:', err);
              setIsAuthInitialized(true); // Still initialize the app
            });
        } else {
          setIsAuthInitialized(true); // Initialize even if silent SSO fails
        }
      });
  }, [instance]);

  // Check authentication whenever the component mounts or MSAL state changes
  useEffect(() => {
    checkAuthentication();
  }, [instance]);

  if (!isAuthInitialized) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Loading...</h2>
        <p>Please wait while we check your authentication status.</p>
      </div>
    );
  }

  return (
    <Router>
      <Header />
      <div className="main-content">
        <Routes>
          <Route
            path="/"
            element={<HomePage isAuthenticated={isAuthenticated} />}
          />
          {isAuthenticated && (
            <>
              <Route path="/hr" element={<HRPage />} />
              <Route path="/it" element={<ITPage />} />
            </>
          )}
          <Route
            path="*"
            element={
              <HomePage isAuthenticated={isAuthenticated} />
            }
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;