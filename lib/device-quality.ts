export type QualityTier = "low" | "medium" | "high";

type NavigatorWithExtras = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

/**
 * Picks a WebGL quality tier from the device's capabilities. Runs on the
 * client only (touches `window`/`navigator`), so call it after mount.
 *
 * The countdown's cost is dominated by additive-blend fill rate, which mobile
 * GPUs (and mobile Firefox / iOS Safari in particular) handle poorly, so we
 * bias phones and tablets toward "low" unless the hardware is clearly strong.
 */
export function getDeviceQuality(): QualityTier {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "medium";
  }

  const nav = navigator as NavigatorWithExtras;
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const saveData = Boolean(nav.connection?.saveData);
  const coarsePointer =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const smallViewport = Math.min(window.innerWidth, window.innerHeight) < 820;
  const isMobile =
    coarsePointer || /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(nav.userAgent);

  if (saveData) {
    return "low";
  }

  if (isMobile || smallViewport) {
    // Phones/tablets: keep the particle + fill budget small. Only the
    // strongest mobile hardware earns a bump to medium.
    return cores >= 8 && memory >= 6 ? "medium" : "low";
  }

  // Desktop / laptop.
  if (cores <= 4 || memory <= 4) {
    return "medium";
  }

  return "high";
}
