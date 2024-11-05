import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import HomePage from './components/HomePage';
import HRPage from './components/HRPage';
import ITPage from './components/ITPage';

const App: React.FC = () => {
  return (
    <Router>
      <Header />
      <div className="main-content">
        <Sidebar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/hr" element={<HRPage />} />
          <Route path="/it" element={<ITPage />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;