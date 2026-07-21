import React from 'react';
import Header from './components/Header';
import HomePage from './components/HomePage';
import { UserInfo } from './types/user';

const companyProgressUser: UserInfo = {
  isAuthenticated: true,
  isEliteGroup: false,
  hasPowerBILicense: true,
};

const App: React.FC = () => {
  return (
    <>
      <Header />
      <div className="main-content">
        <HomePage userInfo={companyProgressUser} />
      </div>
    </>
  );
};

export default App;