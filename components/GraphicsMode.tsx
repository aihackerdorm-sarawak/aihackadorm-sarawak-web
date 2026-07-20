"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type GraphicsModeContextValue = {
  graphicsEnabled: boolean;
  setGraphicsEnabled: (value: boolean) => void;
  toggleGraphics: () => void;
};

const STORAGE_KEY = "aihackadorm.graphicsEnabled";

const GraphicsModeContext = createContext<GraphicsModeContextValue | null>(null);

function detectLowPowerDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  const cores = navigator.hardwareConcurrency ?? 4;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const saveData =
    "connection" in navigator &&
    Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

  return Boolean(saveData || cores <= 4 || (coarsePointer && cores <= 6));
}

function getInitialGraphicsState() {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "true" || saved === "false") {
      return saved === "true";
    }
  } catch {
    // Ignore storage read failures and fall back to detection.
  }

  return !detectLowPowerDevice();
}

export function GraphicsModeProvider({ children }: { children: ReactNode }) {
  const [graphicsEnabled, setGraphicsEnabled] = useState(getInitialGraphicsState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(graphicsEnabled));
    } catch {
      // Ignore storage failures and keep the toggle functional.
    }
  }, [graphicsEnabled]);

  const value = useMemo<GraphicsModeContextValue>(
    () => ({
      graphicsEnabled,
      setGraphicsEnabled,
      toggleGraphics: () => setGraphicsEnabled((current) => !current),
    }),
    [graphicsEnabled]
  );

  return <GraphicsModeContext.Provider value={value}>{children}</GraphicsModeContext.Provider>;
}

export function useGraphicsMode() {
  const context = useContext(GraphicsModeContext);

  if (!context) {
    throw new Error("useGraphicsMode must be used within a GraphicsModeProvider");
  }

  return context;
}

