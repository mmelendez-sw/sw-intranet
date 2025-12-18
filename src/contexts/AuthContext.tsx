import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import { isEliteGroupMember } from '../authConfig';
import { UserInfo } from '../types/user';
import type { IPublicClientApplication } from '@azure/msal-browser';

interface AuthContextType {
  userInfo: UserInfo;
  isLoading: boolean;
  error: string | null;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const getCachedEliteStatus = (email: string): boolean | null => {
  const cachedStatus = localStorage.getItem(`elite_status_${email}`);
  const cachedTimestamp = localStorage.getItem(`elite_status_timestamp_${email}`);
  
  if (!cachedStatus || !cachedTimestamp) {
    return null;
  }
  
  const cacheAge = Date.now() - parseInt(cachedTimestamp, 10);
  if (cacheAge > CACHE_DURATION) {
    localStorage.removeItem(`elite_status_${email}`);
    localStorage.removeItem(`elite_status_timestamp_${email}`);
    return null;
  }
  
  return cachedStatus === 'true';
};

const setCachedEliteStatus = (email: string, isElite: boolean): void => {
  localStorage.setItem(`elite_status_${email}`, isElite.toString());
  localStorage.setItem(`elite_status_timestamp_${email}`, Date.now().toString());
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { instance } = useMsal();
  const [userInfo, setUserInfo] = useState<UserInfo>({
    isAuthenticated: false,
    isEliteGroup: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuthentication = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const accounts = instance.getAllAccounts();
      if (accounts.length === 0) {
        setUserInfo({
          isAuthenticated: false,
          isEliteGroup: false,
        });
        setIsLoading(false);
        return;
      }

      const account = accounts[0];
      const email = account.username || account.homeAccountId;
      
      // Check cache first
      const cachedEliteStatus = getCachedEliteStatus(email);
      
      if (cachedEliteStatus !== null) {
        setUserInfo({
          isAuthenticated: true,
          isEliteGroup: cachedEliteStatus,
          email,
          name: account.name,
        });
        setIsLoading(false);
        
        // Check in background to refresh cache
        checkEliteStatusInBackground(instance, email);
        return;
      }

      // Set authenticated state immediately
      setUserInfo({
        isAuthenticated: true,
        isEliteGroup: false,
        email,
        name: account.name,
      });

      // Check elite status
      await checkEliteStatus(instance, email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication check failed');
      setIsLoading(false);
    }
  }, [instance]);

  const checkEliteStatus = async (
    msalInstance: IPublicClientApplication,
    email: string
  ): Promise<void> => {
    try {
      const isElite = await isEliteGroupMember(msalInstance);
      setCachedEliteStatus(email, isElite);
      
      setUserInfo((prev) => ({
        ...prev,
        isEliteGroup: isElite,
      }));
    } catch (err) {
      // On error, default to non-elite
      setCachedEliteStatus(email, false);
      setUserInfo((prev) => ({
        ...prev,
        isEliteGroup: false,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const checkEliteStatusInBackground = async (
    msalInstance: IPublicClientApplication,
    email: string
  ): Promise<void> => {
    try {
      const isElite = await isEliteGroupMember(msalInstance);
      setCachedEliteStatus(email, isElite);
      
      setUserInfo((prev) => ({
        ...prev,
        isEliteGroup: isElite,
      }));
    } catch (err) {
      // Silently fail in background check
    }
  };

  useEffect(() => {
    checkAuthentication();

    const callbackId = instance.addEventCallback((event) => {
      if (
        event.eventType === EventType.LOGIN_SUCCESS ||
        event.eventType === EventType.LOGOUT_SUCCESS ||
        event.eventType === EventType.ACCOUNT_ADDED ||
        event.eventType === EventType.ACCOUNT_REMOVED
      ) {
        checkAuthentication();
      }
    });

    return () => {
      if (callbackId) {
        instance.removeEventCallback(callbackId);
      }
    };
  }, [instance, checkAuthentication]);

  const refreshAuth = useCallback(async () => {
    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      const email = accounts[0].username || accounts[0].homeAccountId;
      localStorage.removeItem(`elite_status_${email}`);
      localStorage.removeItem(`elite_status_timestamp_${email}`);
    }
    await checkAuthentication();
  }, [instance, checkAuthentication]);

  return (
    <AuthContext.Provider value={{ userInfo, isLoading, error, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

