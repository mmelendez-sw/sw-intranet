import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import '../styles/global.css';
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig"

const msalInstance = new PublicClientApplication(msalConfig);

// MSAL v3 requires initialize() to be awaited before the app renders.
// Without this, the browser returning from a redirect-based auth flow will
// render the app before MSAL has processed the auth response in the URL
// hash, causing the user to appear unauthenticated after successful login.
const renderApp = async () => {
  await msalInstance.initialize();
  // Ensure any redirect-based auth response is processed before rendering.
  // This is especially important on mobile Safari where the redirect flow is
  // the primary path and timing can otherwise make the user look logged out.
  try {
    await msalInstance.handleRedirectPromise();
  } catch (e) {
    // Don't block app render on redirect handling failures; MSAL will surface
    // auth errors via its event callbacks in-app.
    console.error(e);
  }
  ReactDOM.render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>,
    document.getElementById('root')
  );
};

renderApp();