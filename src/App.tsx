import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './components/HomePage';
import HRPage from './components/HRPage';
import ITPage from './components/ITPage';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';

const App: React.FC = () => {
  const isAuthenticated = useIsAuthenticated();

  return (
    <Router>
      <Header />
      <div className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage isAuthenticated={isAuthenticated} />
            }
          />
          {isAuthenticated && (
            <>
              <Route path="/hr" element={<HRPage />} />
              <Route path="/it" element={<ITPage />} />
            </>
          )}
          {!isAuthenticated && (
            <Route
              path="*"
              element={
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <h2>Access Denied</h2>
                  <p>Please log in to view this page.</p>
                </div>
              }
            />
          )}
        </Routes>
      </div>
    </Router>
  );
};

export default App;