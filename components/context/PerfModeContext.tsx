"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type PerfModeContextType = {
  isPerfMode: boolean;
  setPerfMode: (value: boolean) => void;
};

const PerfModeContext = createContext<PerfModeContextType>({
  isPerfMode: false,
  setPerfMode: () => {},
});

export function PerfModeProvider({ children }: { children: ReactNode }) {
  const [isPerfMode, setIsPerfMode] = useState(false);

  const setPerfMode = useCallback((value: boolean) => {
    setIsPerfMode(value);
  }, []);

  return (
    <PerfModeContext.Provider value={{ isPerfMode, setPerfMode }}>
      {children}
    </PerfModeContext.Provider>
  );
}

/**
 * Hook to access perf mode state from any page.
 * Pages should call setPerfMode(isScrolling) when scroll state changes.
 */
export function usePerfMode() {
  return useContext(PerfModeContext);
}

export default PerfModeContext;

