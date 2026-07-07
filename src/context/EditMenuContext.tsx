import React, { createContext, useCallback, useContext, useState } from 'react';

interface EditModeContextValue {
  isEditMode: boolean;
  toggleEditMode: () => void;
}

const EditModeContext = createContext<EditModeContextValue | null>(null);

const EDIT_MODE_SESSION_KEY = 'intranet_edit_mode';

const readPersistedEditMode = (): boolean => {
  try {
    return sessionStorage.getItem(EDIT_MODE_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
};

const persistEditMode = (enabled: boolean): void => {
  try {
    sessionStorage.setItem(EDIT_MODE_SESSION_KEY, String(enabled));
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
};

export const EditMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isEditMode, setIsEditMode] = useState(readPersistedEditMode);
  const toggleEditMode = useCallback(() => {
    setIsEditMode((v) => {
      const next = !v;
      persistEditMode(next);
      return next;
    });
  }, []);

  return (
    <EditModeContext.Provider value={{ isEditMode, toggleEditMode }}>
      {children}
    </EditModeContext.Provider>
  );
};

export const useEditMode = (): EditModeContextValue => {
  const ctx = useContext(EditModeContext);
  if (!ctx) {
    throw new Error('useEditMode must be used within EditMenuProvider');
  }
  return ctx;
};
