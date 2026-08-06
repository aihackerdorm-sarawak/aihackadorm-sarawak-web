"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  // Firefox's Canvas2D/WebGL paths are noticeably slower than Chrome/Safari's
  // on equivalent hardware, so its wave/countdown chug even on strong
  // machines — default graphics off there regardless of the specs below.
  const isFirefox = /Firefox/i.test(navigator.userAgent);

  // Deliberately lax: only genuinely weak hardware defaults graphics off.
  // saveData is an explicit user opt-out, so it always wins.
  return Boolean(saveData || isFirefox || cores <= 2 || (coarsePointer && cores <= 4));
}

// Reads the persisted preference. Returns null when nothing is saved so the
// caller can fall back to device detection.
function readSavedGraphicsState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "true" || saved === "false") {
      return saved === "true";
    }
  } catch {
    // Ignore storage read failures and fall back to detection.
  }

  return null;
}

// Stable no-op subscribe for useSyncExternalStore below (the store is only
// ever read here; writes go through the toggle's setState, not the store).
const subscribeNoop = () => () => {};

// The real, client-only initial preference: saved localStorage value, else
// device detection. Computed once and cached so the snapshot stays
// referentially stable across renders.
let cachedClientInitialValue: boolean | null = null;
function getClientInitialGraphicsState() {
  if (cachedClientInitialValue === null) {
    cachedClientInitialValue = readSavedGraphicsState() ?? !detectLowPowerDevice();
  }
  return cachedClientInitialValue;
}

export function GraphicsModeProvider({ children }: { children: ReactNode }) {
  // The graphics preference is client-only (localStorage + device detection,
  // neither exists during SSR), so read it through useSyncExternalStore:
  // React renders with the server snapshot (graphics ON) during SSR and
  // hydration, then switches to the real client value once mounted. That is
  // the one pattern React explicitly allows to differ between server and
  // client WITHOUT a hydration error. A lazy useState initializer cannot be
  // used here: on Firefox detection returns OFF, which disagreed with the
  // server's ON default and made React regenerate the whole tree. The toggle
  // (a user action, not an effect) drives the override below.
  const detectedInitial = useSyncExternalStore(
    subscribeNoop,
    getClientInitialGraphicsState,
    () => true
  );
  const [override, setOverride] = useState<boolean | null>(null);
  const graphicsEnabled = override ?? detectedInitial;

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
      setGraphicsEnabled: setOverride,
      toggleGraphics: () => setOverride((current) => !(current ?? detectedInitial)),
    }),
    [detectedInitial, graphicsEnabled]
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
