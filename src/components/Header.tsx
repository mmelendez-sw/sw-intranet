import React from 'react';
import logo from '../../images/sti-horizontal-white.png';

interface HeaderProps {
  userInfo?: {
    isAuthenticated: boolean;
    isEliteGroup: boolean;
    hasPowerBILicense?: boolean;
  };
}

const Header: React.FC<HeaderProps> = () => {
  return (
    <header className="header" style={{ zIndex: 5000 }}>
      <img src={logo} alt="Symphony Towers" className="header-logo" />
    </header>
  );
};

export default Header;