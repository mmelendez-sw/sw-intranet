import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './components/HomePage';
import HRPage from './components/HRPage';
import ITPage from './components/ITPage';
import TechnologyReports from './components/Reports';

const App: React.FC = () => {
  // Always set authentication to true to disable Microsoft auth
  const userInfo = {
    isAuthenticated: true,
    isEliteGroup: true
  };

  return (
    <Router>
      <Header />
      <div className="main-content">
        <Routes>
          <Route
            path="/"
            element={<HomePage userInfo={userInfo} />}
          />
          <Route path="/technology" element={<TechnologyReports />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;