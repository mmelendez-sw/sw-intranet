import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import '../styles/global.css';
// After App + global.css so its :where()-scoped rules win cascade ties; inert unless data-theme="dark".
import '../styles/dark-theme.css';
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";
import { warmHomepageImageCache } from './services/contentService';
import { preloadBundledHomepageImages } from './utils/homepageImageWarmup';
import { clearLegacyLocalStorageImageCache } from './utils/sharePointImageIdb';

const msalInstance = new PublicClientApplication(msalConfig);

// MSAL v3 requires initialize() to be awaited before the app renders.
// Without this, the browser returning from a redirect-based auth flow will
// render the app before MSAL has processed the auth response in the URL
// hash, causing the user to appear unauthenticated after successful login.
const renderApp = async () => {
  clearLegacyLocalStorageImageCache();
  preloadBundledHomepageImages();

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

  // Warm IndexedDB/object-URL cache without blocking first paint.
  void warmHomepageImageCache(msalInstance);

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
