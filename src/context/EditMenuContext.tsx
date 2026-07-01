import React, { createContext, useCallback, useContext, useState } from 'react';

interface EditModeContextValue {
  isEditMode: boolean;
  toggleEditMode: () => void;
}

const EditModeContext = createContext<EditModeContextValue | null>(null);

export const EditMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const toggleEditMode = useCallback(() => setIsEditMode((v) => !v), []);

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
