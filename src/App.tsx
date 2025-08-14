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
            
            console.log('🔍 Results - Elite:', isElite, 'Power BI:', hasPowerBILicense);
            
            // Cache the results
            localStorage.setItem(`elite_status_${email}`, isElite.toString());
            localStorage.setItem(`powerbi_license_${email}`, hasPowerBILicense.toString());
            localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
            
            // Update user info with the correct statuses
            setUserInfo({
              isAuthenticated: true,
              isEliteGroup: isElite,
              hasPowerBILicense: hasPowerBILicense,
              email: email,
              name: account.name,
            });
            
            console.log('🔍 Authentication check completed successfully');
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
              // Set fallback values
              setUserInfo({
                isAuthenticated: true,
                isEliteGroup: false,
                hasPowerBILicense: false,
                email: email,
                name: account.name,
              });
            }
          }
        }
      }
    } else {
      console.log('🔍 No user accounts found');
      setUserInfo({
        isAuthenticated: false,
        isEliteGroup: false,
        hasPowerBILicense: false,
      });
    }
  };

  useEffect(() => {
    checkAuthentication();
  }, [instance]);

  useEffect(() => {
    if (userInfo.isAuthenticated) {
      // Add debug functions to window for manual testing
      (window as any).debugUserState = () => {
        console.log('🔍 Current user state:', userInfo);
        console.log('🔍 Elite group:', userInfo.isEliteGroup);
        console.log('🔍 Power BI license:', userInfo.hasPowerBILicense);
      };
      
      (window as any).refreshEliteStatus = async () => {
        console.log('🔍 Manually refreshing elite status...');
        try {
          const isElite = await isEliteGroupMember(instance);
          console.log('🔍 Manual elite check result:', isElite);
          
          const accounts = instance.getAllAccounts();
          if (accounts.length > 0) {
            const email = accounts[0].username || accounts[0].homeAccountId;
            localStorage.setItem(`elite_status_${email}`, isElite.toString());
            localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
            
            setUserInfo(prev => ({
              ...prev,
              isEliteGroup: isElite
            }));
            
            console.log('🔍 Elite status refreshed successfully');
          }
        } catch (error) {
          console.error('❌ Manual elite status refresh failed:', error);
        }
      };
      
      (window as any).clearEliteCache = () => {
        console.log('🔍 Clearing elite status cache...');
        const accounts = instance.getAllAccounts();
        if (accounts.length > 0) {
          const email = accounts[0].username || accounts[0].homeAccountId;
          localStorage.removeItem(`elite_status_${email}`);
          localStorage.removeItem(`powerbi_license_${email}`);
          localStorage.removeItem(`elite_status_timestamp_${email}`);
          console.log('🔍 Elite status cache cleared');
        }
      };
      
      (window as any).forceEliteCheck = async () => {
        console.log('🔍 Force checking elite status...');
        try {
          const isElite = await isEliteGroupMember(instance);
          console.log('🔍 Force elite check result:', isElite);
          
          const accounts = instance.getAllAccounts();
          if (accounts.length > 0) {
            const email = accounts[0].username || accounts[0].homeAccountId;
            localStorage.setItem(`elite_status_${email}`, isElite.toString());
            localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
            
            setUserInfo(prev => ({
              ...prev,
              isEliteGroup: isElite
            }));
            
            console.log('🔍 Elite status force updated');
          }
        } catch (error) {
          console.error('❌ Force elite check failed:', error);
        }
      };
      
      (window as any).checkPowerBILicense = async () => {
        console.log('🔍 Manually checking Power BI license...');
        try {
          const hasLicense = await checkPowerBILicense(instance);
          console.log('🔍 Manual Power BI license check result:', hasLicense);
          
          const accounts = instance.getAllAccounts();
          if (accounts.length > 0) {
            const email = accounts[0].username || accounts[0].homeAccountId;
            localStorage.setItem(`powerbi_license_${email}`, hasLicense.toString());
            localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
            
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