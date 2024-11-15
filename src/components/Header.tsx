import React, { useEffect, useState } from 'react';
import '../../styles/header.css';
import blue_logo from '../../images/symph_blue_t.png';
import white_logo from '../../images/symph_white_t.png';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from '../authConfig';
// import { fetchUserPhoto } from '../graphClient';

const Header: React.FC = () => {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  // const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch((e) => {
      console.error(e);
    });
  };

  const handleLogout = () => {
    instance.logoutPopup().catch((e) => {
      console.error(e);
    });
  };

  // useEffect(() => {
  //   if (isAuthenticated && accounts[0]) {
  //     // Fetch user photo after login
  //     fetchUserPhoto(accounts[0]).then((photo) => setPhotoUrl(photo));
  //   }
  // }, [isAuthenticated, accounts]);

  return (
    <header className="header">
      <img src={white_logo} alt="Logo" className="logo-image" />
      <nav className="nav-bar">
        <i className="fa-solid fa-house"></i> <a href="/">Home</a>
        <i className="fa-solid fa-tower-cell"></i><a href="/acquisitions">Acquisitions</a>
        <i className="fa-solid fa-wallet"></i><a href="/pricing">Pricing</a>
        <i className="fa-brands fa-readme"></i><a href="/legal">Legal</a>
        <i className="fa-solid fa-icons"></i><a href="/marketing">Marketing</a>
        <i className="fa-solid fa-user"></i><a href="/hr">HR</a>
        <i className="fa-solid fa-laptop"></i><a href="/it">IT</a>
      </nav>
      <div className="user">
        {isAuthenticated && accounts[0] ? (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* {photoUrl && (
              <img
                src={photoUrl}
                alt="User"
                className="user-photo"
                style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '10px' }}
              />
            )} */}
            <span>Welcome, {(accounts[0]?.name?.split(" ")[0]) || "User"}!</span>
            <button onClick={handleLogout} className="logout-button">Logout</button>
          </div>
        ) : (
          <button onClick={handleLogin} className="login-button">Login</button>
        )}
      </div>
    </header>
  );
};

export default Header;