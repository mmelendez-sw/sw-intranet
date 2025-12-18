import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { useAuth } from './contexts/AuthContext';

// Lazy load pages for code splitting
const HomePage = lazy(() => import('./components/HomePage').then(module => ({ default: module.default })));
const ITPage = lazy(() => import('./components/ITPage').then(module => ({ default: module.default })));
const Reports = lazy(() => import('./components/Reports').then(module => ({ default: module.default })));

const App: React.FC = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <LoadingSpinner size="large" message="Loading application..." />
      </div>
    );
  }

  return (
    <Router>
      <Header />
      <div className="main-content">
        <Suspense fallback={<LoadingSpinner size="large" />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/technology"
              element={
                <ProtectedRoute>
                  <ITPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/acquisitions"
              element={
                <ProtectedRoute>
                  <div>Acquisitions Page - Coming Soon</div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/origination"
              element={
                <ProtectedRoute>
                  <div>Origination Page - Coming Soon</div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/legal"
              element={
                <ProtectedRoute>
                  <div>Legal Page - Coming Soon</div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketing"
              element={
                <ProtectedRoute>
                  <div>Marketing Page - Coming Soon</div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr"
              element={
                <ProtectedRoute>
                  <div>Human Resources Page - Coming Soon</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
};

export default App;
