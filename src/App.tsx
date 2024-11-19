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

  useEffect(() => {
    // Attempt silent SSO on app load
    instance
      .ssoSilent({
        scopes: loginRequest.scopes,
      })
      .then(() => {
        console.log('Silent SSO successful.');
        setIsAuthenticated(true);
        setIsAuthInitialized(true);
      })
      .catch((error) => {
        console.error('Silent SSO failed:', error);

        if (error.name === 'InteractionRequiredAuthError') {
          console.log('Fallback to interactive login required.');
          instance
            .loginPopup(loginRequest)
            .then(() => {
              console.log('Interactive login successful.');
              setIsAuthenticated(true);
              setIsAuthInitialized(true);
            })
            .catch((err) => {
              console.error('Interactive login failed:', err);
              setIsAuthInitialized(true);
            });
        } else {
          setIsAuthInitialized(true);
        }
      });
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
          {/* Redirect to home page if no matching route */}
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