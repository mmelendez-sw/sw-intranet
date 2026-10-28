import React, { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import Header from './components/Header';
import HomePage from './components/HomePage';
import UpdateAvailableBanner from './components/UpdateAvailableBanner';
import SalesforceHealthBanner from './components/SalesforceHealthBanner';
import PageViewTracker from './components/PageViewTracker';
// import TvDisplay from './components/TvDisplay';
import {
  BYPASS_AUTH,
  DEV_USER_INFO,
  INTRANET_EDITORS_GROUP_ID,
  INTRANET_EXECS_GROUP_ID,
  checkGroupMemberships,
  resolveIsEditor,
  isNetSuiteAdminAllowlisted,
  isIcemanAllowlisted,
  isAnalyticsViewerAllowlisted,
  isDevPreviewAllowlisted,
} from './authConfig';

// Secondary routes load on first visit; the homepage bundle stays small for everyone.
const Reports = lazy(() => import('./components/Reports'));
const LeadGeneration = lazy(() => import('./components/LeadGeneration'));
const Iceman = lazy(() => import('./components/Iceman'));
const EmployeeDirectory = lazy(() => import('./components/EmployeeDirectory'));
const DevPreview = lazy(() => import('./components/DevPreview'));
const SiteUsage = lazy(() => import('./components/SiteUsage'));

const RouteFallback: React.FC = () => (
  <div className="app-loading" role="status" aria-label="Loading">
    <div className="app-loading-spinner" aria-hidden="true" />
  </div>
);
import { UserInfo } from './types/user';
import { EditMenuProvider } from './context/EditMenuContext';
import { ThemeProvider } from './context/ThemeContext';

import {
  readCachedEditorStatus,
  readCachedEliteStatus,
  writeCachedEditorStatus,
  writeCachedEliteStatus,
} from './utils/groupStatusCache';

/** Re-check group membership this long after every retry in a refresh failed. */
const GROUP_RETRY_AFTER_FAILURE_MS = 60_000;

function buildUserInfoFromAccount(instance: ReturnType<typeof useMsal>['instance']): UserInfo {
  if (BYPASS_AUTH) return DEV_USER_INFO;

  const accounts = instance.getAllAccounts();
  if (accounts.length === 0) {
    return {
      isAuthenticated: false,
      isEliteGroup: false,
      isEditor: false,
      isNetSuiteAdmin: false,
    };
  }

  const account = accounts[0];
  const email = account.username || account.homeAccountId;
  const elite = readCachedEliteStatus(email);
  const editor = readCachedEditorStatus(email);

  // Stale-while-revalidate: paint immediately from any cached true/false,
  // including expired entries, then refresh Graph in the background.
  return {
    isAuthenticated: true,
    isEliteGroup: elite.value === true,
    isEditor: resolveIsEditor(editor.value === true, email),
    isNetSuiteAdmin: isNetSuiteAdminAllowlisted(email),
    email,
    name: account.name,
  };
}

const App: React.FC = () => {
  const { instance } = useMsal();
  const hasSignedInAccount = instance.getAllAccounts().length > 0;
  const [userInfo, setUserInfo] = useState<UserInfo>(() => buildUserInfoFromAccount(instance));
  const refreshInFlight = useRef<Promise<void> | null>(null);
  /** Pending re-check after every retry failed; cleared on unmount / next refresh. */
  const retryTimer = useRef<number | null>(null);
  const unmounted = useRef(false);

  const refreshGroupMembership = async () => {
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    if (BYPASS_AUTH) {
      setUserInfo(DEV_USER_INFO);
      return;
    }

    const accounts = instance.getAllAccounts();
    if (accounts.length === 0) {
      setUserInfo({
        isAuthenticated: false,
        isEliteGroup: false,
        isEditor: false,
        isNetSuiteAdmin: false,
      });
      return;
    }

    const account = accounts[0];
    const email = account.username || account.homeAccountId;
    const eliteCache = readCachedEliteStatus(email);
    const editorCache = readCachedEditorStatus(email);
    const isNetSuiteAdmin = isNetSuiteAdminAllowlisted(email);

    // Apply cache synchronously so elite reports are visible on first paint.
    setUserInfo({
      isAuthenticated: true,
      isEliteGroup: eliteCache.value === true,
      isEditor: resolveIsEditor(editorCache.value === true, email),
      isNetSuiteAdmin,
      email,
      name: account.name,
    });

    // Always revalidate: the cache is only for first paint, so users newly added to the
    // Elite/Editor groups pick up access on their next page load instead of after 24h.
    const retryDelays = [0, 400, 1000, 2000, 4000];
    let lastError: unknown = null;

    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      if (retryDelays[attempt] > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
      }
      try {
        // Both groups in one checkMemberGroups call (and one call per retry).
        const memberOf = await checkGroupMemberships(instance, [
          INTRANET_EXECS_GROUP_ID,
          INTRANET_EDITORS_GROUP_ID,
        ]);
        const isElite = memberOf.has(INTRANET_EXECS_GROUP_ID);
        const isEditor = resolveIsEditor(memberOf.has(INTRANET_EDITORS_GROUP_ID), email);

        writeCachedEliteStatus(email, isElite);
        writeCachedEditorStatus(email, isEditor);

        setUserInfo((prev) => ({
          ...prev,
          isAuthenticated: true,
          isEliteGroup: isElite,
          isEditor,
          isNetSuiteAdmin,
          email,
          name: account.name,
        }));
        return;
      } catch (error) {
        lastError = error;
        console.warn(`[App] group membership check failed (attempt ${attempt + 1}):`, error);
      }
    }

    // Indeterminate failure: keep stale elite/editor paint; never cache false. Try again in
    // a minute so a transient Graph outage doesn't pin stale access for the whole visit.
    console.warn('[App] keeping cached group status after failed refresh:', lastError);
    if (!unmounted.current) {
      retryTimer.current = window.setTimeout(() => {
        retryTimer.current = null;
        void checkAuthentication();
      }, GROUP_RETRY_AFTER_FAILURE_MS);
    }
  };

  const checkAuthentication = async (forceNetwork = false) => {
    if (refreshInFlight.current && !forceNetwork) {
      await refreshInFlight.current;
      return;
    }
    const run = refreshGroupMembership().finally(() => {
      refreshInFlight.current = null;
    });
    refreshInFlight.current = run;
    await run;
  };

  useLayoutEffect(() => {
    if (BYPASS_AUTH) return;
    setUserInfo((prev) => {
      const next = buildUserInfoFromAccount(instance);
      if (
        prev.isAuthenticated === next.isAuthenticated &&
        prev.isEliteGroup === next.isEliteGroup &&
        prev.isEditor === next.isEditor &&
        prev.email === next.email
      ) {
        return prev;
      }
      return next;
    });
  }, [instance]);

  useEffect(() => {
    void checkAuthentication();

    const callbackId = instance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS) {
        void checkAuthentication(true);
      }
      if (event.eventType === EventType.LOGOUT_SUCCESS) {
        void checkAuthentication(true);
      }
      if (event.eventType === EventType.ACCOUNT_ADDED || event.eventType === EventType.ACCOUNT_REMOVED) {
        void checkAuthentication(true);
      }
    });

    return () => {
      if (callbackId) instance.removeEventCallback(callbackId);
    };
  }, [instance]);

  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    };
  }, []);

  return (
    <Router>
      <UpdateAvailableBanner />
      <PageViewTracker enabled={userInfo.isAuthenticated} />
      <Routes>
        {/* ── Standalone TV / kiosk display — disabled on this branch
        <Route path="/tv" element={<TvDisplay />} />
        */}

        {/* ── All standard routes — wrapped with the header ── */}
        <Route
          path="/*"
          element={
            <ThemeProvider email={userInfo.isAuthenticated ? userInfo.email : undefined}>
            <EditMenuProvider>
              <Header userInfo={userInfo} />
              <div className="main-content">
                <SalesforceHealthBanner userInfo={userInfo} />
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<HomePage userInfo={userInfo} />} />
                    <Route
                      path="/lead-generation"
                      element={userInfo.isAuthenticated || hasSignedInAccount ? <LeadGeneration userInfo={userInfo} /> : <Navigate to="/" replace />}
                    />
                    <Route
                      path="/iceman"
                      element={
                        (userInfo.isAuthenticated || hasSignedInAccount) && isIcemanAllowlisted(userInfo.email)
                          ? <Iceman userInfo={userInfo} />
                          : <Navigate to="/" replace />
                      }
                    />
                    {userInfo.isAuthenticated && (
                      <>
                        <Route path="/directory" element={<EmployeeDirectory />} />
                        <Route path="/reports" element={<Reports userInfo={userInfo} />} />
                        <Route
                          path="/usage"
                          element={
                            isAnalyticsViewerAllowlisted(userInfo.email)
                              ? <SiteUsage />
                              : <Navigate to="/" replace />
                          }
                        />
                        <Route
                          path="/dev"
                          element={
                            isDevPreviewAllowlisted(userInfo.email)
                              ? <DevPreview userInfo={userInfo} />
                              : <Navigate to="/" replace />
                          }
                        />
                      </>
                    )}
                  </Routes>
                </Suspense>
              </div>
            </EditMenuProvider>
            </ThemeProvider>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
