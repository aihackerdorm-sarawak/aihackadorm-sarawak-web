@AGENTS.md

# Project notes

## Countdown timer — `components/CountdownScene.tsx`

A WebGL (react-three-fiber) dot-matrix countdown. Each of the 4 segments
(DAYS/HOURS/MINS/SECS) is a `CountdownDigitGroup` with its own `BufferGeometry`.
The particle pool is partitioned into fixed slot ranges — label slots (sampled
**once**, never re-touched) plus one range per digit position — so only the
digit(s) that actually change get re-sampled/reassigned, and the tens/ones dots
can never swap. Digits render in two additive passes: a soft **glow** layer +
a sharp **core** layer (this two-layer trick is the "bloom" — cheap, keep it;
do NOT add postprocessing bloom). On a value change, dots are matched to the
nearest new target (`assignNearestTargets`) and eased in with a damped spring
(momentum + slight overshoot), not a linear lerp.

Rules & gotchas (hard-won — don't relearn these):
- **`gl_PointSize` is in framebuffer pixels, not CSS pixels**, so dot size is
  DPR-dependent and rendered differently per display / browser zoom / browser.
  Neutralised via `uDprScale = renderer.getPixelRatio() / REFERENCE_DPR` in the
  vertex shader. If dots look uniformly too large/small on every device, tune
  the `REFERENCE_DPR` constant (currently 1.5) — it's the single size knob.
- **Quality tier** comes from `lib/device-quality.ts` `getDeviceQuality()`,
  computed client-side after mount and threaded down as the `quality` prop.
  Desktop tier is keyed on `hardwareConcurrency` **only** — deliberately NOT on
  window size or `deviceMemory` (Chromium-only) — so the same machine renders
  the same tier in every browser and at any window size. Mobile (coarse pointer
  / mobile UA) → `low`.
- **All per-tier numbers live in `getSettings()`**: canvas dims, point sizes,
  `sampleStride`, `maxParticles`, `glowLayerScale`, `glowOpacity`. Every tier
  MUST be `stacked`-aware for `canvasWidth`/`canvasHeight` (portrait when
  stacked). A non-stacked-aware tier feeds the mobile 4-row layout through a
  landscape canvas and squishes the digits.
- Layout: mobile is "stacked" (`max-width: 768px`) = 4 vertical rows; desktop
  is one landscape row. Mobile digit size is driven by `computeFontSizes`
  (stacked branch) + `layoutScale` + the frame height in `HackathonLandingPage`.
- Idle-skip: the per-frame particle loop early-returns once settled (no pointer,
  no flash), but `uTime` keeps updating so the twinkle/wave never freeze.
- Per-digit flash-on-change is scoped to the changed digit's slot range via
  `baseSizes` — never flash the whole segment (looks like a glitch).

## Other components
- `SiteHeader.tsx` — desktop nav is `hidden lg:flex`; below `lg` a working
  hamburger dropdown menu handles navigation.
- Hero (in `HackathonLandingPage.tsx`) and the lower `WaveZone` each render a
  `WaveBackground` dot-wave, gated on the Graphics toggle + in-view.
- `ScheduleSection` — timeline dots sit in a row **below** the text; prev/next
  arrow buttons + a position counter drive it (mobile-friendly stepper).

## Known open items (from a full-site scan — NOT yet done)
- Content inconsistencies: "24-hour" vs "48 hours", "Oct 10-11" vs Oct 10→12;
  brand name "HackerDorm" vs "Hackadorm"; placeholder `mailto:example@gmail.com`.
- `lib/countdown.ts` target dates parse in the viewer's local time (no `+08:00`)
  → wrong countdown for anyone outside UTC+8.
- `CountdownSection` gates render on `isMounted` set inside a
  `requestAnimationFrame` → countdown is absent in a background/unfocused tab
  until it's focused. Fix = set `isMounted` in a plain `useEffect`.
- Dead/unused code: `Hero.tsx`, `HeroScene.tsx`, `ContentSections.tsx`,
  `PartnerForm.tsx`, `CountdownHero.tsx`, `app/api/contact/route.ts`.
- No web font is actually loaded (globals.css references `--font-geist-*` but
  `next/font` is never imported); metadata is thin (no OpenGraph/viewport).
- Netlify deploys `main`; the timer/header/wave work lives on
  `wavedot-noah-testbranch` — it must be merged to `main` to go live.
