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
 *
 * The desktop tier is keyed on CPU concurrency ONLY — deliberately not on
 * window size or `deviceMemory`:
 *   - Window size drifts per browser (a non-maximized window would otherwise
 *     silently drop to a sparser, blobbier tier), so the same machine must
 *     not render differently in Edge vs Chrome vs a smaller window.
 *   - `deviceMemory` is Chromium-only; Firefox/Safari report `undefined`, so
 *     using it as a gate downgrades those browsers even on strong hardware.
 * `hardwareConcurrency` is reported by every modern browser, so it gives a
 * stable, cross-browser-consistent result on a given machine.
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
  const isMobile =
    coarsePointer || /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(nav.userAgent);

  if (saveData) {
    return "low";
  }

  if (isMobile) {
    // Phones/tablets: keep the particle + fill budget small. Only the
    // strongest mobile hardware earns a bump to medium.
    return cores >= 8 && memory >= 6 ? "medium" : "low";
  }

  // Desktop / laptop — hardware concurrency only (see doc comment above).
  if (cores <= 4) {
    return "medium";
  }

  return "high";
}
