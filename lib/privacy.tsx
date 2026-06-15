"use client";

import { createContext, useContext, useEffect, useState } from "react";

type PrivacyCtx = { hidden: boolean; toggle: () => void };

export const PrivacyContext = createContext<PrivacyCtx>({
  hidden: false,
  toggle: () => {},
});

const STORAGE_KEY = "budget_privacy_hidden";

// Global provider (header toggle). Lives at the app root.
export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  // Restore the saved preference after mount (avoids SSR/client mismatch).
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1") {
      setHidden(true);
    }
  }, []);

  function toggle() {
    setHidden((h) => {
      const next = !h;
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      }
      return next;
    });
  }

  return (
    <PrivacyContext.Provider value={{ hidden, toggle }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyCtx {
  return useContext(PrivacyContext);
}

// Per-box privacy: a box is hidden when the global toggle is on OR its own
// local toggle is on. Returns the effective hidden flag plus a box-local toggle.
export function useBoxPrivacy(): PrivacyCtx {
  const { hidden: globalHidden } = usePrivacy();
  const [boxHidden, setBoxHidden] = useState(false);
  return {
    hidden: globalHidden || boxHidden,
    toggle: () => setBoxHidden((b) => !b),
  };
}
