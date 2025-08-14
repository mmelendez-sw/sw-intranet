import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import Header from './components/Header';
import HomePage from './components/HomePage';
import HRPage from './components/HRPage';
import ITPage from './components/ITPage';
import Reports from './components/Reports';
import { loginRequest, isEliteGroupMember } from './authConfig';
import { checkPowerBILicense } from './services/powerbiLicenseService';
import { UserInfo } from './types/user';
import { getGroupIds } from './utils/getGroupId';

const App: React.FC = () => {
  const { instance } = useMsal();
  const [userInfo, setUserInfo] = useState<UserInfo>({
    isAuthenticated: false,
    isEliteGroup: false,
  });

  const checkAuthentication = async () => {
    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      const account = accounts[0];
      const email = account.username || account.homeAccountId;
      
      console.log('🔍 Checking authentication for:', email);
      
      // Check if we have cached elite status for this user
      const cachedEliteStatus = localStorage.getItem(`elite_status_${email}`);
      const cachedPowerBILicense = localStorage.getItem(`powerbi_license_${email}`);
      const cachedTimestamp = localStorage.getItem(`elite_status_timestamp_${email}`);
      let isElite = false;
      let hasPowerBILicense = false;
      
      // Check if cache is still valid (24 hours)
      const cacheValid = cachedTimestamp && (Date.now() - parseInt(cachedTimestamp)) < (24 * 60 * 60 * 1000);
      
      console.log('🔍 Cache check:', { 
        cachedEliteStatus, 
        cachedPowerBILicense,
        cachedTimestamp, 
        cacheValid, 
        currentTime: Date.now(),
        cacheAge: cachedTimestamp ? Date.now() - parseInt(cachedTimestamp) : 'N/A'
      });
      
      if (cachedEliteStatus && cachedPowerBILicense && cacheValid) {
        isElite = cachedEliteStatus === 'true';
        hasPowerBILicense = cachedPowerBILicense === 'true';
        console.log('🔍 Using cached statuses - Elite:', isElite, 'Power BI:', hasPowerBILicense);
        
        // Set user info immediately with cached statuses
        setUserInfo({
          isAuthenticated: true,
          isEliteGroup: isElite,
          hasPowerBILicense: hasPowerBILicense,
          email: email,
          name: account.name,
        });
      } else {
        console.log('🔍 Cache invalid or missing, checking memberships and licenses...');
        
        // Set user as authenticated immediately but with statuses pending
        setUserInfo({
          isAuthenticated: true,
          isEliteGroup: false, // Will be updated once we get the real status
          hasPowerBILicense: false, // Will be updated once we get the real status
          email: email,
          name: account.name,
        });
        
        // Wait a bit to ensure MSAL is fully initialized
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check both elite group membership and Power BI license in parallel
        let retryCount = 0;
        const maxRetries = 5; // Increased retries
        const retryDelays = [1000, 2000, 3000, 5000, 8000]; // Progressive delays
        
        while (retryCount < maxRetries) {
          try {
            console.log('🔍 Checking elite group membership and Power BI license (attempt', retryCount + 1, ')...');
            
            // Check both in parallel
            const [eliteResult, powerBILicenseResult] = await Promise.all([
              isEliteGroupMember(instance),
              checkPowerBILicense(instance)
            ]);
            
            isElite = eliteResult;
            hasPowerBILicense = powerBILicenseResult;
            
            console.log('🔍 Elite group membership result:', isElite);
            console.log('🔍 Power BI license result:', hasPowerBILicense);
            
            // Cache the results with timestamp
            localStorage.setItem(`elite_status_${email}`, isElite.toString());
            localStorage.setItem(`powerbi_license_${email}`, hasPowerBILicense.toString());
            localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
            console.log('🔍 Cached statuses - Elite:', isElite, 'Power BI:', hasPowerBILicense);
            
            // Update user info with the correct statuses
            setUserInfo(prev => ({
              ...prev,
              isEliteGroup: isElite,
              hasPowerBILicense: hasPowerBILicense
            }));
            
            break; // Success, exit retry loop
          } catch (error) {
            console.error('❌ Error checking memberships and licenses (attempt', retryCount + 1, '):', error);
            retryCount++;
            if (retryCount < maxRetries) {
              const delay = retryDelays[retryCount - 1] || 8000;
              console.log(`🔍 Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              console.log('🔍 Max retries reached, defaulting to non-elite and no Power BI license');
              isElite = false;
              hasPowerBILicense = false;
              // Cache the fallback results
              localStorage.setItem(`elite_status_${email}`, 'false');
              localStorage.setItem(`powerbi_license_${email}`, 'false');
              localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
              
              // Update user info with fallback statuses
              setUserInfo(prev => ({
                ...prev,
                isEliteGroup: false,
                hasPowerBILicense: false
              }));
            }
          }
        }
        
        console.log('🔍 Final statuses - Elite:', isElite, 'Power BI:', hasPowerBILicense);
        console.log('🔍 Setting user info:', { isAuthenticated: true, isEliteGroup: isElite, hasPowerBILicense: hasPowerBILicense, email, name: account.name });
      }
    } else {
      console.log('🔍 No accounts found, setting unauthenticated state');
      setUserInfo({
        isAuthenticated: false,
        isEliteGroup: false,
        hasPowerBILicense: false,
      });
    }
  };

  useEffect(() => {
    // Check authentication status on app load
    checkAuthentication();

    // Listen to MSAL events for account changes
    const callbackId = instance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS) {
        console.log('Login successful, updating state.');
        checkAuthentication();
      }

      if (event.eventType === EventType.LOGOUT_SUCCESS) {
        console.log('Logout successful, updating state.');
        checkAuthentication();
      }

      if (event.eventType === EventType.ACCOUNT_ADDED || event.eventType === EventType.ACCOUNT_REMOVED) {
        console.log('Account state changed, updating state.');
        checkAuthentication();
      }
    });

    return () => {
      // Clean up event listener
      if (callbackId) {
        instance.removeEventCallback(callbackId);
      }
    };
  }, [instance]);

  // Immediate elite check on app initialization
  useEffect(() => {
    const initializeEliteCheck = async () => {
      const accounts = instance.getAllAccounts();
      if (accounts.length > 0) {
        const account = accounts[0];
        const email = account.username || account.homeAccountId;
        
        // Check if we have a valid cached elite status
        const cachedEliteStatus = localStorage.getItem(`elite_status_${email}`);
        const cachedPowerBILicense = localStorage.getItem(`powerbi_license_${email}`);
        const cachedTimestamp = localStorage.getItem(`elite_status_timestamp_${email}`);
        const cacheValid = cachedTimestamp && (Date.now() - parseInt(cachedTimestamp)) < (24 * 60 * 60 * 1000);
        
        if (cachedEliteStatus && cachedPowerBILicense && cacheValid) {
          const isElite = cachedEliteStatus === 'true';
          const hasPowerBILicense = cachedPowerBILicense === 'true';
          console.log('🔍 Initial elite check from cache:', isElite, 'Power BI:', hasPowerBILicense);
          
          // Update user info immediately if we have valid cached elite status
          setUserInfo(prev => ({
            ...prev,
            isAuthenticated: true,
            isEliteGroup: isElite,
            hasPowerBILicense: hasPowerBILicense,
            email: email,
            name: account.name,
          }));
        } else {
          // If no valid cache, try an immediate elite check
          console.log('🔍 No valid cache, attempting immediate elite check...');
          try {
            const [isElite, hasPowerBILicense] = await Promise.all([
              isEliteGroupMember(instance),
              checkPowerBILicense(instance)
            ]);
            console.log('🔍 Immediate elite check result:', isElite, 'Power BI:', hasPowerBILicense);
            
            // Cache the result
            localStorage.setItem(`elite_status_${email}`, isElite.toString());
            localStorage.setItem(`powerbi_license_${email}`, hasPowerBILicense.toString());
            localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
            
            // Update user info
            setUserInfo(prev => ({
              ...prev,
              isAuthenticated: true,
              isEliteGroup: isElite,
              hasPowerBILicense: hasPowerBILicense,
              email: email,
              name: account.name,
            }));
          } catch (error) {
            console.log('🔍 Immediate elite check failed, will retry in main flow:', error);
          }
        }
      }
    };
    
    // Run initialization check
    initializeEliteCheck();
  }, [instance]);

  // Additional effect to ensure group membership is checked after initial render
  useEffect(() => {
    if (userInfo.isAuthenticated && !userInfo.isEliteGroup) {
      console.log('🔍 User authenticated but elite status not set, checking group membership...');
      
      // Run immediate check
      const immediateCheck = async () => {
        await checkAuthentication();
      };
      
      // Also run a delayed check as backup
      const delayedCheck = async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await checkAuthentication();
      };
      
      // Persistent check for elite users who might not have been detected yet
      const persistentCheck = async () => {
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts && userInfo.isAuthenticated && !userInfo.isEliteGroup) {
          attempts++;
          console.log(`🔍 Persistent elite check attempt ${attempts}/${maxAttempts}...`);
          
          try {
            const isElite = await isEliteGroupMember(instance);
            if (isElite) {
              console.log('🔍 Elite access detected in persistent check!');
              
              // Update cache and state
              const accounts = instance.getAllAccounts();
              if (accounts.length > 0) {
                const email = accounts[0].username || accounts[0].homeAccountId;
                localStorage.setItem(`elite_status_${email}`, 'true');
                localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
                
                setUserInfo(prev => ({
                  ...prev,
                  isEliteGroup: true
                }));
                break; // Success, exit loop
              }
            }
          } catch (error) {
            console.log(`🔍 Persistent check attempt ${attempts} failed:`, error);
          }
          
          // Wait before next attempt (progressive delay)
          const delay = Math.min(1000 * attempts, 8000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      };
      
      immediateCheck();
      delayedCheck();
      persistentCheck();
    }
  }, [userInfo.isAuthenticated, userInfo.isEliteGroup, instance]);

  // Temporary debug function - remove after getting the group ID
  useEffect(() => {
    if (userInfo.isAuthenticated) {
      // Add this to window for debugging
      (window as any).debugGroups = () => getGroupIds(instance);
      (window as any).debugUserState = () => {
        console.log('🔍 Current user state:', userInfo);
        console.log('🔍 Is authenticated:', userInfo.isAuthenticated);
        console.log('🔍 Is elite group:', userInfo.isEliteGroup);
        console.log('🔍 Has Power BI license:', userInfo.hasPowerBILicense);
        console.log('🔍 User email:', userInfo.email);
        console.log('🔍 User name:', userInfo.name);
      };
      (window as any).refreshEliteStatus = async () => {
        console.log('🔍 Manually refreshing elite status...');
        if (userInfo.email) {
          localStorage.removeItem(`elite_status_${userInfo.email}`);
          localStorage.removeItem(`powerbi_license_${userInfo.email}`);
          localStorage.removeItem(`elite_status_timestamp_${userInfo.email}`);
          console.log('🔍 Cleared cached elite status');
        }
        await checkAuthentication();
      };
      (window as any).clearEliteCache = () => {
        if (userInfo.email) {
          localStorage.removeItem(`elite_status_${userInfo.email}`);
          localStorage.removeItem(`powerbi_license_${userInfo.email}`);
          localStorage.removeItem(`elite_status_timestamp_${userInfo.email}`);
          console.log('🔍 Cleared elite status cache for:', userInfo.email);
        }
      };
      (window as any).forceEliteCheck = async () => {
        console.log('🔍 Force checking elite status (bypassing cache)...');
        const accounts = instance.getAllAccounts();
        if (accounts.length > 0) {
          const account = accounts[0];
          const email = account.username || account.homeAccountId;
          
          try {
            console.log('🔍 Force checking group membership for:', email);
            const isElite = await isEliteGroupMember(instance);
            console.log('🔍 Force check result:', isElite);
            
            // Update cache and state
            localStorage.setItem(`elite_status_${email}`, isElite.toString());
            localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
            
            setUserInfo(prev => ({
              ...prev,
              isEliteGroup: isElite
            }));
            
            console.log('🔍 Updated user state with elite status:', isElite);
          } catch (error) {
            console.error('❌ Force check failed:', error);
          }
        }
      };
      (window as any).checkPowerBILicense = async () => {
        console.log('🔍 Manually checking Power BI license...');
        try {
          const hasLicense = await checkPowerBILicense(instance);
          console.log('🔍 Power BI license check result:', hasLicense);
          
          // Update cache and state
          const accounts = instance.getAllAccounts();
          if (accounts.length > 0) {
            const email = accounts[0].username || accounts[0].homeAccountId;
            localStorage.setItem(`powerbi_license_${email}`, hasLicense.toString());
            
            setUserInfo(prev => ({
              ...prev,
              hasPowerBILicense: hasLicense
            }));
            
            console.log('🔍 Updated user state with Power BI license status:', hasLicense);
          }
        } catch (error) {
          console.error('❌ Power BI license check failed:', error);
        }
      };
      (window as any).startPersistentEliteCheck = async () => {
        console.log('🔍 Starting persistent elite check...');
        let attempts = 0;
        const maxAttempts = 15;
        
        while (attempts < maxAttempts) {
          attempts++;
          console.log(`🔍 Manual persistent check attempt ${attempts}/${maxAttempts}...`);
          
          try {
            const isElite = await isEliteGroupMember(instance);
            console.log(`🔍 Attempt ${attempts} result:`, isElite);
            
            if (isElite) {
              console.log('🔍 Elite access detected!');
              
              // Update cache and state
              const accounts = instance.getAllAccounts();
              if (accounts.length > 0) {
                const email = accounts[0].username || accounts[0].homeAccountId;
                localStorage.setItem(`elite_status_${email}`, 'true');
                localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
                
                setUserInfo(prev => ({
                  ...prev,
                  isEliteGroup: true
                }));
                console.log('🔍 Elite status updated successfully!');
                break;
              }
            }
          } catch (error) {
            console.log(`🔍 Manual check attempt ${attempts} failed:`, error);
          }
          
          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        if (attempts >= maxAttempts) {
          console.log('🔍 Manual persistent check completed without success');
        }
      };
      console.log('🔍 To find your group ID, run: window.debugGroups() in the console');
      console.log('🔍 To check current user state, run: window.debugUserState() in the console');
      console.log('🔍 To refresh elite status, run: window.refreshEliteStatus() in the console');
      console.log('🔍 To clear elite cache, run: window.clearEliteCache() in the console');
      console.log('🔍 To force elite check, run: window.forceEliteCheck() in the console');
      console.log('🔍 To check Power BI license, run: window.checkPowerBILicense() in the console');
      console.log('🔍 To start persistent elite check, run: window.startPersistentEliteCheck() in the console');
    }
  }, [userInfo.isAuthenticated, instance, userInfo]);

  return (
    <Router>
      <Header userInfo={userInfo} />
      <div className="main-content">
        <Routes>
          <Route
            path="/"
            element={<HomePage userInfo={userInfo} />}
          />
          {userInfo.isAuthenticated && (
            <>
              <Route path="/ITPage" element={<ITPage />} />
              <Route path="/reports" element={<Reports userInfo={userInfo} />} />
              <Route path="/acquisitions" element={<div>Acquisitions Page - Coming Soon</div>} />
              <Route path="/origination" element={<div>Origination Page - Coming Soon</div>} />
              <Route path="/legal" element={<div>Legal Page - Coming Soon</div>} />
              <Route path="/marketing" element={<div>Marketing Page - Coming Soon</div>} />
              <Route path="/hr" element={<div>Human Resources Page - Coming Soon</div>} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
};

export default App;