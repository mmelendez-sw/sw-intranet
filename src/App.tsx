import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import Header from './components/Header';
import AlertBanner from './components/AlertBanner';
import Ticker from './components/Ticker';
import HomePage from './components/HomePage';
// import DepartmentPage from './components/DepartmentPage';
// import { DEPARTMENTS } from './config/departments';
import Reports from './components/Reports';
import LeadGeneration from './components/LeadGeneration';
import Iceman from './components/Iceman';
import DevHomePage from './components/DevHomePage';
import EmployeeDirectory from './components/EmployeeDirectory';
// import TvDisplay from './components/TvDisplay';
import { BYPASS_AUTH, DEV_USER_INFO, isEliteGroupMember, isEditorGroupMember, resolveIsEditor, isNetSuiteAdminAllowlisted, isIcemanAllowlisted, isDevHomepageAllowlisted } from './authConfig';
import { UserInfo } from './types/user';
import { getGroupIds } from './utils/getGroupId';
import { EditMenuProvider } from './context/EditMenuContext';
import { ThemeProvider } from './context/ThemeContext';

import {
  readCachedEditorStatus,
  readCachedEliteStatus,
  writeCachedEditorStatus,
  writeCachedEliteStatus,
} from './utils/groupStatusCache';

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

  const refreshGroupMembership = async (forceNetwork = false) => {
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

    const eliteFresh = eliteCache.fresh && !forceNetwork;
    const editorFresh = editorCache.fresh && !forceNetwork;
    if (eliteFresh && editorFresh) {
      // Still recover editors stuck on a false cache from older transient failures.
      if (editorCache.value === false && !resolveIsEditor(false, email)) {
        try {
          const isMember = await isEditorGroupMember(instance);
          const verified = resolveIsEditor(isMember, email);
          if (verified) {
            writeCachedEditorStatus(email, true);
            setUserInfo((prev) => (prev.isEditor ? prev : { ...prev, isEditor: true }));
          }
        } catch {
          // keep optimistic state
        }
      }
      return;
    }

    const retryDelays = [0, 400, 1000, 2000, 4000];
    let lastError: unknown = null;

    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      if (retryDelays[attempt] > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
      }
      try {
        const [eliteResult, editorResult] = await Promise.all([
          isEliteGroupMember(instance),
          isEditorGroupMember(instance),
        ]);
        const isElite = eliteResult;
        const isEditor = resolveIsEditor(editorResult, email);

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

    // Indeterminate failure: keep stale elite/editor paint; never cache false.
    console.warn('[App] keeping cached group status after failed refresh:', lastError);
  };

  const checkAuthentication = async (forceNetwork = false) => {
    if (refreshInFlight.current && !forceNetwork) {
      await refreshInFlight.current;
      return;
    }
    const run = refreshGroupMembership(forceNetwork).finally(() => {
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
    if (!userInfo.isAuthenticated) return;

    (window as any).debugGroups = () => getGroupIds(instance);
    (window as any).debugUserState = () => {
      console.log('Current user state:', userInfo);
    };
    (window as any).refreshEliteStatus = async () => {
      if (userInfo.email) {
        localStorage.removeItem(`elite_status_${userInfo.email}`);
        localStorage.removeItem(`elite_status_timestamp_${userInfo.email}`);
      }
      await checkAuthentication(true);
    };
    (window as any).clearEliteCache = () => {
      if (userInfo.email) {
        localStorage.removeItem(`elite_status_${userInfo.email}`);
        localStorage.removeItem(`elite_status_timestamp_${userInfo.email}`);
      }
    };
    (window as any).forceEliteCheck = async () => {
      await checkAuthentication(true);
    };
  }, [userInfo, instance]);

  return (
    <Router>
      <Routes>
        {/* ── Standalone TV / kiosk display — disabled on this branch
        <Route path="/tv" element={<TvDisplay />} />
        */}

        {/* ── All standard routes — wrapped with header + alert banner ── */}
        <Route
          path="/*"
          element={
            <ThemeProvider email={userInfo.isAuthenticated ? userInfo.email : undefined}>
            <EditMenuProvider>
              <Header userInfo={userInfo} />
              {/* <div className="below-header">
                <AlertBanner userInfo={userInfo} />
                <Ticker userInfo={userInfo} />
              </div> */}
              <div className="main-content">
                <Routes>
                  <Route path="/" element={<HomePage userInfo={userInfo} />} />
                  <Route
                    path="/dev"
                    element={
                      userInfo.isAuthenticated && isDevHomepageAllowlisted(userInfo.email)
                        ? <DevHomePage userInfo={userInfo} />
                        : <Navigate to="/" replace />
                    }
                  />
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
                      {/* Department page routes disabled — restore when pages are ready
                      {DEPARTMENTS.map((department) => (
                        <Route
                          key={department.path}
                          path={department.path}
                          element={<DepartmentPage userInfo={userInfo} department={department} />}
                        />
                      ))}
                      */}
                    </>
                  )}
                </Routes>
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
