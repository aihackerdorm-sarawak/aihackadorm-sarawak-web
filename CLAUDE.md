@AGENTS.md

# Project notes

## Countdown timer — `components/CountdownScene.tsx`

A WebGL (react-three-fiber) dot-matrix countdown. Each of the 4 segments
(DAYS/HOURS/MINS/SECS) is a `CountdownDigitGroup` with its own `BufferGeometry`.
The particle pool is partitioned into fixed slot ranges — label slots (sampled
**once**, never re-touched) plus one range per digit position — so only the
digit(s) that actually change get re-sampled/reassigned, and the tens/ones dots
can never swap. Digits render in a **single** additive pass now (the old
two-layer glow+core bloom trick was dropped — the site moved away from a
bloom-heavy look, so `uSoftness`/`uGlowInner`/`uGlowOuter` blend a soft edge
into one sprite instead of drawing a second, larger, dimmer halo pass).
`PALETTE` is cyan-toned (`#a5f3fc`/`#22d3ee`/`#0891b2`) to match the site's
cyan cyberpunk accent (see the "future" word in the hero and the global
chromatic-aberration text-shadow in `globals.css`) — still NOT postprocessing
bloom, still cheap. On a value change, dots are matched to the nearest new
target (`assignNearestTargets`) and eased in with a damped spring (momentum +
slight overshoot), not a linear lerp.

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
  `sampleStride`, `maxParticles`, `dotOpacity`. Every tier
  MUST be `stacked`-aware for `canvasWidth`/`canvasHeight` (portrait when
  stacked). A non-stacked-aware tier feeds the mobile 4-row layout through a
  landscape canvas and squishes the digits.
- Layout: mobile is "stacked" (`max-width: 768px`) = 4 vertical rows; desktop
  is one landscape row. Mobile digit size is driven by `computeFontSizes`
  (stacked branch) + `layoutScale` + the frame height in `HackathonLandingPage`.
- **Hover is a "magnifying glass / water droplet" lens** (inspired by the
  OpenAI Build Week countdown), built from THREE independent effects, each with
  its own radius so they tune separately. `uPointer` (world xy) is updated each
  frame from the hit-plane `onPointerMove`; parked at 999 off-canvas so every
  falloff naturally drops to zero when the cursor leaves (no `pointerActive`
  flag). The three layers:
  1. **Repel** (`repelRadius`/`repelStrength`, JS spring loop) — dots within
     the radius are pushed radially out of their grid slot (power-curve
     falloff) then spring back. The loop is kept awake while hovering via
     `pointerNear` (from `pointerWorld.x < 500`).
  2. **Magnify** (`MAGNIFY_RADIUS`/`MAGNIFY_BOOST`, vertex shader) — dots swell
     via `gl_PointSize *= 1 + smoothstep(MAGNIFY_RADIUS→0)*MAGNIFY_BOOST`, like
     pixels under a droplet.
  3. **Chromatic aberration** (`CHROMA_RADIUS`/`CHROMA_AMOUNT`/`CHROMA_RED_LIFT`,
     fragment shader) — the dot's disc is sampled at RGB-split offsets along the
     radial-from-cursor direction (`gl_PointCoord.y` flipped vs world y) for a
     red/cyan lens fringe. Base dots are cyan so `CHROMA_RED_LIFT` adds a little
     red for the split to read. Kept subtle — this REPLACED an earlier strong
     white-glow/brightness boost the user found too heavy.
  Fragment outputs `alpha = 1.0` and premultiplies coverage into rgb: with
  `AdditiveBlending` (SRC_ALPHA,ONE) that makes the off-hover result identical
  to the plain dot, so hover adds NOTHING until the cursor is near. Don't
  "restore" a brightness/white term — the ask was chromatic aberration, not glow.
- Idle-skip: the per-frame particle loop early-returns once settled (no motion,
  no flash), but `uTime` keeps updating so the twinkle/wave never freeze.
- Per-digit flash-on-change is scoped to the changed digit's slot range via
  `baseSizes` — never flash the whole segment (looks like a glitch).

## Other components
- `SiteHeader.tsx` — desktop nav is `hidden lg:flex`; below `lg` a working
  hamburger dropdown menu handles navigation.
- Hero (in `HackathonLandingPage.tsx`) and the lower `WaveZone` each render a
  `WaveBackground` dot-wave, gated on the Graphics toggle + in-view. Both use
  the identical component/defaults — if they ever look different, suspect the
  active/observer wiring, not two configs.
- `WaveBackground.tsx` (2D canvas) perf & structure — hard-won, keep:
  - Split into two effects. The **setup** effect (deps: `dotColor`/`ambient`)
    seeds `dots`/`ripples` once and owns them for the canvas's life. The
    **active-toggle** effect (dep: `active`) only starts/stops the rAF loop +
    ambient timer. `active` is deliberately NOT a setup dep — otherwise every
    scroll-out/in tears down and re-seeds the field to a flat grid, so a
    section that toggles often never builds up the busy ripple state a
    long-lived wave has.
  - **Visible-band culling is the main perf lever.** A `WaveZone` canvas is as
    tall as the whole stacked section (~2825px, ~23k dots) but only ~one
    viewport shows. Each frame computes the on-screen band from the canvas
    rect (canvas coords == CSS px, DPR is forced to 1) ± `CULL_MARGIN`, and
    both `update()` physics and `draw()` skip dots outside it, and the bg is
    re-filled only over the band. That cut the big canvas from ~27ms to ~3ms
    per frame; do NOT revert to drawing/stepping all dots.
  - No `globalCompositeOperation = "lighter"` — it's a real Firefox Canvas2D
    cost and, with non-overlapping spaced dots, invisible. A pre-rendered
    sprite + `drawImage` was measured SLOWER than `arc()`+`fill()` here, so
    don't "optimize" the draw that way.
  - `useSectionObserver` (in `HackathonLandingPage.tsx`) gates `active` with
    `threshold: 0` + `rootMargin: "200px"`. `threshold` is a fraction of the
    target's OWN height, so a big `WaveZone` target must use 0, not a fraction
    (a fraction kept the wave frozen until deep into a scroll).
- `ScheduleSection` — timeline dots sit in a row **below** the text; prev/next
  arrow buttons + a position counter drive it (mobile-friendly stepper).

## Known open items (from a full-site scan — NOT yet done)
- Content inconsistencies: "Oct 10-11" vs Oct 10→12; brand name "HackerDorm"
  vs "Hackadorm"; placeholder `mailto:example@gmail.com`. (The 24-hour vs
  48-hour duration mismatch is fixed — event copy and `lib/countdown.ts`
  `eventEnds` both now agree on 24 hours.)
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
