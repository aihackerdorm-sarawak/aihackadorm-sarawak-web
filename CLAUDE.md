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
chromatic-aberration text-shadow in `globals.css` — a COOL cyan→blue split,
NOT red/cyan: a warm/magenta side reads pink on white text and fights the
palette, so don't reintroduce one) — still NOT postprocessing
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
  The chromatic split re-samples the disc (`dotAlpha`) 3×, so it's guarded by
  `if (vChroma > 0.001)` — non-hovered fragments (i.e. ALL of them when idle)
  do a SINGLE sample. `vChroma` is constant per point-sprite so the branch is
  coherent (no GPU divergence). Do NOT unconditionalize the 3× sampling — it
  tripled fragment fill-rate for the whole timer every frame.
- Idle-skip: the per-frame particle loop early-returns once settled (no motion,
  no flash), but `uTime` keeps updating so the twinkle/wave never freeze.
- Per-digit flash-on-change is scoped to the changed digit's slot range via
  `baseSizes` — never flash the whole segment (looks like a glitch).
- **Lifecycle & resize perf** (don't regress):
  - Mount gate uses `useSyncExternalStore` (false on server/hydration, true
    once mounted), NOT an `isMounted` flag set in `requestAnimationFrame` — rAF
    is paused in a background/unfocused tab, which left the countdown absent
    until focus. `quality` is a lazy `useState` initializer (device-based,
    computed once). This also dodges the `react-hooks/set-state-in-effect` lint
    rule (enforced as an ERROR here — never call `setState` synchronously in an
    effect body; use a lazy initializer, `useSyncExternalStore`, or an async
    callback).
  - `useViewportWidth/Height` (in `CountdownScene.tsx`) and the container
    `ResizeObserver` (in `CountdownWebGLFrame`) are **debounced 150ms**. A live
    resize otherwise re-runs the digit-group structural effect (which rebuilds
    ~8 offscreen canvases + `getImageData`) on every intermediate size. First
    paint still uses the immediate initial size, so no startup delay.
  - The `fonts` fit (`computeFontSizes` binary-search + `measureText`) is keyed
    on the longest value's LENGTH, not on `values` (which change every second) —
    Arial Black digits are tabular so the fit only depends on length.

## Other components
- `SiteHeader.tsx` — desktop nav is `hidden lg:flex`; below `lg` a working
  hamburger dropdown menu handles navigation.
- Hero (in `HackathonLandingPage.tsx`) and the lower `WaveZone` each render a
  `WaveBackground` dot-wave, gated on the Graphics toggle + in-view. Both use
  the identical component/defaults, so **wave brightness is controlled by the
  shared `dotColor` default** — deliberately a darker grey
  (`rgba(150,150,150,0.4)`, not white) for a subtle, dim texture. Change that
  one value to make BOTH waves lighter/darker together; that's the primary knob
  and keeps the two sections consistent by construction.
- Each wave also has a dark **gradient-overlay `<div>`** on top (for text
  legibility) — a secondary, per-section dim. WaveZone `rgba(3,3,3,0.12)→0.78`
  (stretched over its ~2825px height, so its visible band stays near the light
  end); the hero, only ~one viewport tall, uses a lighter/flatter `0.15→0.45`
  (NOT the same string — matching WaveZone's dark end would over-dim a short
  section). If the two waves ever look mismatched, check `dotColor` first (it's
  shared, so it's rarely the cause), then these overlays — never suspect the
  wave/observer wiring, which is identical.
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

## Registration backend — Google Sheets API (`Google-Sheets-API` branch)

The registration backend: hackathon + workshop submissions are validated,
sanitized, and appended to a Google Sheet. Full detail in `GOOGLE_SHEETS_API.md`
(payloads, columns, env vars, test record). The frontend form does NOT exist
yet — this was built and live-tested first.

- **Config-driven by design** — `lib/registration-config.ts` is the single
  source of truth: every payload field (key, sheet column label, type, max
  length) is one entry in an array. The route validates, sanitizes and
  flattens purely from these definitions. Adding a field = one line there,
  NEVER route logic. Keep it that way (the user asked for scalability).
- **`app/api/register/route.ts`** — `POST /api/register` with
  `{ formType: "workshop" | "hackathon", data }`. `GET /api/register` is a
  smoke test (spreadsheet title/tabs/config) — safe to keep while there's no
  form UI. Validation conventions mirror the old Supabase edge functions
  (`error_code`/`field`).
- **Hard-won gotchas (don't regress):**
  - `spreadsheets.values.append` MUST use `valueInputOption: "RAW"`. With
    `USER_ENTERED`, phone numbers like `+60 12-345-6789` start with `+` and
    get parsed as formulas → every contact column became `#ERROR!`.
  - `teamSize` arrives as a JSON **number**; the generic sanitizer only
    handles strings (stripHtml returns `""` for numbers), so teamSize is
    declared `required: false` in `HACKATHON_META_FIELDS` and validated as an
    integer separately in the route, then re-injected into the row values.
  - `.env` private keys arrive with literal `\n` — code converts
    `GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")` before auth.
  - `ensureTabWithHeaders` writes headers only when the first row is missing
    or entirely empty — never overwrites an existing non-empty row.
  - Hackathon stores **one row per person** (leader + members), team meta
    repeated, `Person Type` column — deliberate choice for filtering/pivoting
    in Sheets; not one row per team.
- **Sheet layout:** tabs `Hackathon` (13 cols) + `Workshop` (7 cols), both
  auto-created with headers on first write. Timestamps are `Asia/Kuching`,
  24h, via `Intl.DateTimeFormat` `formatToParts` (en-CA locale strings like
  `4:05:42 p.m.` were rejected as ugly).
- **Service account auth** — `lib/sheets.ts` uses `@googleapis/sheets`
  (official SDK, `sheets({ version: "v4", auth })` — there is NO `google`
  export; don't import `google` from it). Lazy singleton client. Sheet must
  be shared (Editor) with the service account email.
- **Env vars** (`.env.local`, git-ignored): `GOOGLE_SHEET_ID`,
  `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` (keep quotes),
  optional `GOOGLE_HACKATHON_TAB`/`GOOGLE_WORKSHOP_TAB`. `.env.example` is
  the template but is ALSO matched by the `.env*` gitignore rule — force-add
  it when committing.

## Known open items (from a full-site scan — NOT yet done)
- Content inconsistencies: "Oct 10-11" vs Oct 10→12; brand name "HackerDorm"
  vs "Hackadorm"; placeholder `mailto:example@gmail.com`. (The 24-hour vs
  48-hour duration mismatch is fixed — event copy and `lib/countdown.ts`
  `eventEnds` both now agree on 24 hours.)
- `lib/countdown.ts` target dates parse in the viewer's local time (no `+08:00`)
  → wrong countdown for anyone outside UTC+8.
- Dead/unused code: `Hero.tsx`, `HeroScene.tsx`, `ContentSections.tsx`,
  `PartnerForm.tsx`, `CountdownHero.tsx`, `app/api/contact/route.ts`. Kept
  deliberately (may be reused) — do NOT delete without asking. `Hero`/
  `HeroScene` reference each other; `CountdownLabels` in
  `HackathonLandingPage.tsx` is also unused (source of the one standing eslint
  `no-unused-vars` warning) but intentionally retained.
- `@react-three/postprocessing` is a dependency but imported nowhere — unused,
  left in `package.json` for now.
- `Swinburne-Logo.jpg` is ~784KB for a 64px logo. `next/image` optimizes
  delivery (this is a normal server build, not `output: 'export'`, so clients
  don't get it raw) but the source bloats the repo / first optimize pass;
  worth recompressing to ~15KB.
- No web font is actually loaded (globals.css references `--font-geist-*` but
  `next/font` is never imported); metadata is thin (no OpenGraph/viewport).
- Vercel deploys `main`. The Google Sheets registration backend lives on
  `Google-Sheets-API` — it must be merged to `main` to go live.

## Session status (for the next session to confirm)

Recent pass focused on the countdown hover feel + perf. All changes are on
`wavedot-noah-testbranch`, NOT committed/merged yet, and verified only in the
local dev server + a one-off prod build (`npm run build` / `PORT=xxxx npm run
start`), not on Vercel. To confirm: run `npm run dev`, scroll to the countdown,
hover a digit (dots should swell + repel + show a faint red/cyan fringe, no
white glow), then check `npx tsc --noEmit` and `npx eslint` are clean (one known
`CountdownLabels` no-unused-vars warning is expected).

Landed this session (all reflected in the notes above):
- Countdown hover reworked to the magnifying-glass lens (repel + magnify +
  chromatic aberration), white glow removed, three independent radii.
- Fragment-shader fill-rate guard (`if (vChroma > 0.001)`) — the big GPU win.
- Resize debounced (viewport hooks + container `ResizeObserver`), font-fit memo
  keyed on value length, mount gate moved to `useSyncExternalStore`.
- Earlier in the session: cyan recolor + single-pass digits, label legibility
  (`sampleLabelGrid` coverage sampling, `LABEL_FONT_FAMILY`), labels DAY/HOUR/
  MIN/SEC (singular), faster spring settle, sitewide chromatic-aberration text
  in `globals.css`, cyan section eyebrows, hero "future" cyan, `WaveBackground`
  culling/persist-state fixes, 24h copy alignment, sponsor/prize placeholder
  trim, clickable organizer cards, schedule-card constant height.

Observed but NOT chased (looked like dev-only noise): occasional
`THREE.WebGLRenderer: Context Lost` in the console during the long dev session
(many hot-reloads + multiple live WebGL/canvas contexts). It recovers and the
countdown keeps rendering; it is NOT triggered by app logic. If it recurs in a
FRESH production tab under normal use, investigate WebGL context-loss/restore
handling then — otherwise treat as dev churn.

The dev-server `lightningcss` win32 native-binary error at session start was an
environment issue (arm64 binary present, machine is x64), fixed by deleting
`node_modules` + `package-lock.json` and reinstalling. If `npm run dev` fails on
`Cannot find module '../lightningcss.win32-x64-msvc.node'`, do a clean reinstall.

---

**Next session (Google-Sheets-API branch):** built + live-tested the Google
Sheets registration backend (see the section above and `GOOGLE_SHEETS_API.md`).
Verified against the real spreadsheet: auth, auto tab/header creation, workshop
append, 3-person hackathon append (3 rows), error paths (bad email, team-size
mismatch). Two bugs fixed in-session: `USER_ENTERED` → `RAW` (phone `#ERROR!`),
and number-typed `teamSize` rejected by the string sanitizer. Test rows were
cleared from the sheet; `tsc` + `eslint` clean. Dev server was left running on
port 3000 (`.env.local` loaded). Not done: registration form UI, captcha,
rate limiting, commit of the branch.
