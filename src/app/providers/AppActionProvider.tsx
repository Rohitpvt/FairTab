/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useMemo, useCallback } from "react";

export interface AppActionContextType {
  openAddExpense: () => void;
  closeAddExpense: () => void;
}

export interface AppStateContextType {
  isAddExpenseOpen: boolean;
}

const AppActionContext = createContext<AppActionContextType | null>(null);
const AppStateContext = createContext<AppStateContextType | null>(null);

export const AppActionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  const openAddExpense = useCallback(() => {
    setIsAddExpenseOpen(true);
  }, []);

  const closeAddExpense = useCallback(() => {
    setIsAddExpenseOpen(false);
  }, []);

  const actionValue = useMemo(() => ({
    openAddExpense,
    closeAddExpense,
  }), [openAddExpense, closeAddExpense]);

  const stateValue = useMemo(() => ({
    isAddExpenseOpen,
  }), [isAddExpenseOpen]);

  return (
    <AppActionContext.Provider value={actionValue}>
      <AppStateContext.Provider value={stateValue}>
        {children}
      </AppStateContext.Provider>
    </AppActionContext.Provider>
  );
};

export const useAppActions = () => {
  const context = useContext(AppActionContext);
  if (!context) {
    throw new Error("useAppActions must be used within an AppActionProvider");
  }
  return context;
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppActionProvider");
  }
  return context;
};

export default AppActionProvider;
