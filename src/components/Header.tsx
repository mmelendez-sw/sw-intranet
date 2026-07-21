import React, { useEffect, useState } from 'react';
import logo from '../../images/sti-horizontal-white.png';

interface HeaderProps {
  userInfo?: {
    isAuthenticated: boolean;
    isEliteGroup: boolean;
    hasPowerBILicense?: boolean;
  };
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const Header: React.FC<HeaderProps> = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  return (
    <header className="header" style={{ zIndex: 5000 }}>
      <img src={logo} alt="Symphony Towers" className="header-logo" />
      <div className="header-datetime">
        <div className="header-time">{formatTime(now)}</div>
        <div className="header-date">{formatDate(now)}</div>
      </div>
    </header>
  );
};

export default Header;
