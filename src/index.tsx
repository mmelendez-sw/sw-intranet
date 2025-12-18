import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../styles/global.css';
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const msalInstance = new PublicClientApplication(msalConfig);

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find the root element');
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <MsalProvider instance={msalInstance}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MsalProvider>
    </ErrorBoundary>
  </React.StrictMode>
);