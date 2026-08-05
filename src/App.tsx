import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './components/HomePage';
import TvCompanyProgress from './components/TvCompanyProgress';
import { UserInfo } from './types/user';

/** Kiosk user for the office TV root page (static imagery — no live API required). */
const companyProgressUser: UserInfo = {
  isAuthenticated: true,
  isEliteGroup: false,
  hasPowerBILicense: true,
};

/**
 * serena-tv-dev:
 *   /    — current lobby TV experience (hardcoded company progress image)
 *   /tv  — live Power BI embed (Lambda-backed; Salesforce gauges disabled)
 */
const App: React.FC = () => {
  return (
    <Router>
      <Header />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<HomePage userInfo={companyProgressUser} />} />
          <Route path="/tv" element={<TvCompanyProgress />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;