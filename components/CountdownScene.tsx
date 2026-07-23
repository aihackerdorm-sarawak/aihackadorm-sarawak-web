"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  MathUtils,
  Vector3,
} from "three";
import type { ShaderMaterial } from "three";

type QualityTier = "low" | "medium" | "high";

export type CountdownValue = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

type CountdownSceneProps = {
  active: boolean;
  reducedMotion: boolean;
  quality: QualityTier;
  headerHeightPx: number;
  containerWidthPx: number;
  containerHeightPx: number;
  countdown?: CountdownValue;
};

type SamplePoint = {
  x: number;
  y: number;
  alpha: number;
};

type CountdownSettings = {
  canvasWidth: number;
  canvasHeight: number;
  fontSize: number;
  layoutScale: number;
  sceneWidth: number;
  sceneHeight: number;
  sceneOffsetY: number;
  pointSizeMin: number;
  pointSizeMax: number;
  pointScale: number;
  sampleStride: number;
  maxParticles: number;
  dotOpacity: number;
};

type ParticleSystem = {
  positions: Float32Array;
  velocities: Float32Array;
  basePositions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  baseSizes: Float32Array;
  count: number;
};

const vertexShader = `
attribute float aSize;
attribute vec3 aColor;

varying vec3 vColor;
varying float vSeed;

uniform float uTime;
uniform float uPointScale;
uniform float uLayerScale;
uniform float uDprScale;
uniform float uSceneWidth;
uniform float uSceneHeight;
uniform float uWaveXFrequency;
uniform float uWaveYFrequency;
uniform vec2 uPointer;
uniform float uMagnifyRadius;
uniform float uMagnifyBoost;
uniform float uChromaRadius;

varying float vChroma;
varying vec2 vChromaDir;

void main() {
  vColor = aColor;
  vSeed = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);

  // Magnifying-glass hover: dots within uMagnifyRadius of the cursor swell in
  // size — like screen pixels seen through a droplet of water / a lens. The
  // chromatic radius is a SEPARATE knob so the RGB lens-fringe (in the
  // fragment shader) can cover a tighter/looser area than the swell, and the
  // repel (JS spring loop) has its own radius again — three independent knobs.
  vec2 toDot = position.xy - uPointer;
  float pdist = length(toDot);
  float magnify = smoothstep(uMagnifyRadius, 0.0, pdist);
  vChroma = smoothstep(uChromaRadius, 0.0, pdist);
  vChromaDir = pdist > 0.0001 ? toDot / pdist : vec2(0.0);

  vec3 displaced = position;
  float normalizedX = position.x / max(0.001, uSceneWidth);
  float normalizedY = position.y / max(0.001, uSceneHeight);
  float waveX = normalizedX * uWaveXFrequency;
  float waveY = normalizedY * uWaveYFrequency;
  displaced.z += sin(uTime * 0.7 + waveX + waveY) * 0.012;
  displaced.x += sin(uTime * 0.28 + waveY) * 0.0028;
  displaced.y += cos(uTime * 0.24 + waveX) * 0.0022;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  float perspective = 245.0 / max(0.001, -mvPosition.z);

  // gl_PointSize is in framebuffer pixels, so a fixed value renders at a
  // different on-screen size depending on the device pixel ratio (making
  // dots blob together at low DPR and shrink at high DPR). uDprScale =
  // rendererPixelRatio / REFERENCE_DPR cancels that out, keeping each dot a
  // consistent on-screen size across displays, zoom levels, and builds.
  gl_PointSize = aSize * uPointScale * uLayerScale * perspective * uDprScale * (1.0 + magnify * uMagnifyBoost);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
varying vec3 vColor;
varying float vSeed;
varying float vChroma;
varying vec2 vChromaDir;

uniform float uTime;
uniform float uOpacity;
uniform float uSoftness;
uniform float uGlowInner;
uniform float uGlowOuter;
uniform float uTwinkle;
uniform vec3 uTintColor;
uniform float uChromaAmount;
uniform float uChromaRedLift;

// The dot's soft-disc coverage at a given sprite-space offset from centre.
float dotAlpha(vec2 uv) {
  float dist = length(uv);
  float glow = 1.0 - smoothstep(uGlowInner, uGlowOuter, dist);
  float core = 1.0 - smoothstep(0.0, 0.42, dist);
  return mix(core, core * 0.6 + glow * 0.4, uSoftness);
}

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float twinkle = 1.0 + sin(uTime * 3.7 + vSeed * 6.28318) * uTwinkle;
  float mul = uOpacity * twinkle;

  vec3 baseCol = vColor * uTintColor;

  // Base disc coverage — sampled once; this is the ONLY dotAlpha call for the
  // (overwhelmingly common) un-hovered fragments, so the chromatic split never
  // costs fill rate unless the cursor is actually near. vChroma is constant
  // across a point sprite, so this branch is coherent (no GPU divergence).
  float a = dotAlpha(uv);
  vec3 color;

  if (vChroma > 0.001) {
    // Chromatic aberration (lens fringe): re-sample the disc at RGB-split
    // offsets along the radial-from-cursor direction, so a magnified dot shows
    // a red edge on one side and a cyan edge on the other — light splitting
    // through a lens. gl_PointCoord's y runs opposite to world y, so flip it.
    vec2 off = vec2(vChromaDir.x, -vChromaDir.y) * (vChroma * uChromaAmount);
    float aR = dotAlpha(uv + off);
    float aB = dotAlpha(uv - off);
    // Base dots are cyan (almost no red), so lift red a touch under the cursor
    // for the split to read as a red/cyan fringe rather than a cyan-only smear.
    float redCol = mix(baseCol.r, 1.0, vChroma * uChromaRedLift);
    color = vec3(redCol * aR, baseCol.g * a, baseCol.b * aB);
  } else {
    color = baseCol * a;
  }

  // Premultiply by coverage/opacity/twinkle; output alpha 1 so the additive
  // blend just adds this (the disc falloff already lives in the rgb).
  color *= mul;

  gl_FragColor = vec4(color, 1.0);
}
`;

const PALETTE = ["#a5f3fc", "#22d3ee", "#0891b2"] as const;

function hash01(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

// How long the window must be still before a resize is committed. A live
// resize would otherwise re-render the countdown on every intermediate size,
// each time recomputing settings and re-running the structural effect that
// rebuilds 8 offscreen canvases + getImageData. We sync once immediately on
// mount, then only after the drag settles.
const RESIZE_DEBOUNCE_MS = 150;

function useViewportWidth() {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 1024 : window.innerWidth
  );

  useEffect(() => {
    // No immediate sync needed: the useState initializer already reads
    // window.innerWidth on the client, and this hook only runs client-side
    // (the countdown mounts after isMounted), so there's no SSR value to fix.
    let timer: number;
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setWidth(window.innerWidth), RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener("resize", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", update);
    };
  }, []);

  return width;
}

function useViewportHeight() {
  const [height, setHeight] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight
  );

  useEffect(() => {
    // See useViewportWidth — the initializer covers the initial client value.
    let timer: number;
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHeight(window.innerHeight), RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener("resize", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", update);
    };
  }, []);

  return height;
}

function useStackedLayout() {
  const [stacked, setStacked] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 768px)");
    const update = () => setStacked(query.matches);
    update();

    if (query.addEventListener) {
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }

    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  return stacked;
}

function pixelsToWorldUnits(px: number, viewportHeightPx: number, cameraViewportHeight: number) {
  if (viewportHeightPx <= 0) {
    return 0;
  }

  return (px / viewportHeightPx) * cameraViewportHeight;
}

const COUNTDOWN_FONT_FAMILY = `"Arial Black", "Segoe UI Black", system-ui, sans-serif`;
// Labels use a NORMAL family (not the black display face) so their numeric
// weight actually takes effect — with "Arial Black" the browser renders the
// heavy named face regardless of weight, which dot-samples into thick blobs.
// A lighter weight here reads cleaner at the small label dot count.
const LABEL_FONT_FAMILY = `"Segoe UI", system-ui, Arial, sans-serif`;

function fitTextFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  minFontSize: number,
  maxFontSize: number
) {
  let low = minFontSize;
  let high = maxFontSize;
  let best = minFontSize;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    ctx.font = `900 ${mid}px ${COUNTDOWN_FONT_FAMILY}`;
    const metrics = ctx.measureText(text);
    const textHeight =
      (metrics.actualBoundingBoxAscent || mid * 0.76) +
      (metrics.actualBoundingBoxDescent || mid * 0.24);

    if (metrics.width <= maxWidth && textHeight <= maxHeight) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  ctx.font = `900 ${best}px ${COUNTDOWN_FONT_FAMILY}`;
  return best;
}

function getSettings(
  quality: QualityTier,
  stacked: boolean,
  viewportWidth: number,
  cameraZ: number,
  cameraFov: number,
  containerWidthPx: number,
  containerHeightPx: number
): CountdownSettings {
  const viewportScale = viewportWidth >= 1440 ? 1.08 : viewportWidth >= 1024 ? 1.03 : 1;
  const measuredWidth = Math.max(1, containerWidthPx || 1280);
  const measuredHeight = Math.max(1, containerHeightPx || 300);
  const visibleHeight = 2 * cameraZ * Math.tan((cameraFov * Math.PI) / 360);
  const aspect = measuredWidth / measuredHeight;
  const visibleWidth = visibleHeight * aspect;
  const layoutScale = stacked ? 0.92 : 0.90;
  const particleScale = quality === "high" ? 1.02 : quality === "medium" ? 0.98 : 0.94;

  if (quality === "high") {
    return {
      // Must be stacked-aware like the other tiers: a portrait (tall) canvas
      // for the stacked 4-row mobile layout, landscape for the desktop row.
      // Without this, a narrow window on the high tier feeds a portrait layout
      // through a landscape canvas and the digits render squished/distorted.
      canvasWidth: stacked ? 820 : 1500,
      canvasHeight: stacked ? 940 : 380,
      fontSize: stacked ? 128 : 138,
      layoutScale,
      sceneWidth: visibleWidth * layoutScale,
      sceneHeight: visibleHeight * layoutScale,
      sceneOffsetY: stacked ? -0.18 : -0.06,
      pointSizeMin: 0.032 * viewportScale * particleScale,
      pointSizeMax: 0.062 * viewportScale * particleScale,
      pointScale: 3.9 * viewportScale * particleScale,
      sampleStride: stacked ? 11 : 11,
      maxParticles: stacked ? 3200 : 4400,
      dotOpacity: 0.92,
    };
  }

  if (quality === "low") {
    // Mobile / low-power tier. Sparser sampling + a single render pass (no
    // glow layer) both cut fill rate — the main mobile-GPU bottleneck on
    // Firefox/Safari — and keep the dots from merging into blobs, so the
    // digits read cleaner, not just cheaper.
    return {
      canvasWidth: stacked ? 760 : 1120,
      canvasHeight: stacked ? 860 : 280,
      fontSize: stacked ? 112 : 122,
      layoutScale,
      sceneWidth: visibleWidth * layoutScale,
      sceneHeight: visibleHeight * layoutScale,
      sceneOffsetY: stacked ? -0.17 : -0.06,
      pointSizeMin: 0.023 * viewportScale * particleScale,
      pointSizeMax: 0.044 * viewportScale * particleScale,
      pointScale: 3.0 * viewportScale * particleScale,
      sampleStride: stacked ? 13 : 13,
      maxParticles: stacked ? 1700 : 2400,
      dotOpacity: 0.82,
    };
  }

  return {
    canvasWidth: stacked ? 790 : 1200,
    canvasHeight: stacked ? 900 : 300,
    fontSize: stacked ? 120 : 130,
    layoutScale,
    sceneWidth: visibleWidth * layoutScale,
    sceneHeight: visibleHeight * layoutScale,
    sceneOffsetY: stacked ? -0.16 : -0.06,
    pointSizeMin: 0.029 * viewportScale * particleScale,
    pointSizeMax: 0.056 * viewportScale * particleScale,
    pointScale: 3.5 * viewportScale * particleScale,
    sampleStride: stacked ? 11 : 11,
    maxParticles: stacked ? 2700 : 3700,
    dotOpacity: 0.88,
  };
}

function reduceSamplePoints(points: SamplePoint[], maxParticles: number) {
  if (points.length <= maxParticles) {
    return points;
  }

  const step = Math.max(1, Math.ceil(points.length / maxParticles));
  const reduced: SamplePoint[] = [];

  for (let index = 0; index < points.length; index += step) {
    reduced.push(points[index]);
    if (reduced.length >= maxParticles) {
      break;
    }
  }

  return reduced;
}

const SEGMENT_LABELS = ["DAY", "HOUR", "MIN", "SEC"] as const;

type FontSizes = {
  valueFont: number;
  labelFont: number;
};

type SegmentLayout = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

function getSegmentLayout(
  index: number,
  stacked: boolean,
  settings: CountdownSettings
): SegmentLayout {
  if (stacked) {
    const rowHeight = settings.canvasHeight / 4;
    return { originX: 0, originY: index * rowHeight, width: settings.canvasWidth, height: rowHeight };
  }

  const gap = settings.canvasWidth * 0.012;
  const cardWidth = (settings.canvasWidth - gap * 3) / 4;
  return {
    originX: cardWidth * index + gap * index,
    originY: 0,
    width: cardWidth,
    height: settings.canvasHeight,
  };
}

function computeFontSizes(
  ctx: CanvasRenderingContext2D,
  values: readonly string[],
  stacked: boolean,
  settings: CountdownSettings
): FontSizes {
  const longestValue = values.reduce(
    (longest, value) => (value.length > longest.length ? value : longest),
    values[0]
  );

  if (stacked) {
    // Mobile: digits were height-limited to ~45% of each row, leaving a lot
    // of empty space. Let them fill more of the row (and the wide horizontal
    // room) so the countdown reads much larger on small screens.
    const rowHeight = settings.canvasHeight / 4;
    const maxTextWidth = settings.canvasWidth * 0.8;
    const maxTextHeight = rowHeight * 0.55;

    const valueFont = fitTextFontSize(
      ctx,
      longestValue,
      maxTextWidth,
      maxTextHeight,
      48,
      Math.max(140, Math.round(settings.fontSize * 1.45))
    );
    const labelFont = fitTextFontSize(ctx, "HOUR", settings.canvasWidth * 0.5, rowHeight * 0.2, 16, 50);

    return { valueFont, labelFont };
  }

  const gap = settings.canvasWidth * 0.012;
  const cardWidth = (settings.canvasWidth - gap * 3) / 4;
  const cardHeight = settings.canvasHeight * 0.8;

  const valueFont = fitTextFontSize(
    ctx,
    longestValue,
    cardWidth * 0.9,
    cardHeight * 0.6,
    90,
    Math.max(144, Math.round(settings.fontSize * 1.3))
  );
  const labelFont = fitTextFontSize(ctx, "HOUR", cardWidth * 0.72, cardHeight * 0.26, 20, 50);

  return { valueFont, labelFont };
}

function sampleCanvasPoints(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stride: number,
  layout: SegmentLayout
): SamplePoint[] {
  const image = ctx.getImageData(0, 0, width, height).data;
  const points: SamplePoint[] = [];

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const pixelIndex = (y * width + x) * 4;
      const alpha = image[pixelIndex + 3];

      if (alpha > 12) {
        points.push({ x: layout.originX + x, y: layout.originY + y, alpha });
      }
    }
  }

  return points;
}

// Dot-matrix sampler for small label text. Instead of reading one pixel per
// grid point (which makes thin, light strokes flicker in and out depending on
// where the grid happens to cut them — ragged U/S/C), this averages the glyph
// coverage over each whole grid cell and lights the cell if it clears a
// coverage threshold. That's how a real LED matrix renders type: every cell a
// stroke passes through turns on, giving continuous, evenly-spaced letters.
// All emitted dots are uniform (alpha 255) so there's no size/brightness
// jitter along the strokes.
function sampleLabelGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cell: number,
  layout: SegmentLayout,
  coverageThreshold: number
): SamplePoint[] {
  const image = ctx.getImageData(0, 0, width, height).data;
  const points: SamplePoint[] = [];
  const cellArea = cell * cell;

  for (let gy = 0; gy + cell <= height; gy += cell) {
    for (let gx = 0; gx + cell <= width; gx += cell) {
      let sum = 0;
      for (let y = gy; y < gy + cell; y += 1) {
        const rowBase = y * width;
        for (let x = gx; x < gx + cell; x += 1) {
          sum += image[(rowBase + x) * 4 + 3];
        }
      }
      const coverage = sum / (cellArea * 255);
      if (coverage > coverageThreshold) {
        points.push({
          x: layout.originX + gx + cell / 2,
          y: layout.originY + gy + cell / 2,
          alpha: 255,
        });
      }
    }
  }

  return points;
}

// Draws a single digit into a fixed horizontal slot (rather than the whole
// value string centered as one block) so a digit's on-screen anchor never
// shifts when its neighbor changes shape or width, and so its dots can be
// sampled/matched completely independently of the other digit(s).
function drawCharacterPoints(
  char: string,
  slotIndex: number,
  charCount: number,
  index: number,
  stacked: boolean,
  settings: CountdownSettings,
  valueFont: number
): SamplePoint[] {
  const layout = getSegmentLayout(index, stacked, settings);
  const width = Math.max(1, Math.ceil(layout.width));
  const height = Math.max(1, Math.ceil(layout.height));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return [];
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${valueFont}px ${COUNTDOWN_FONT_FAMILY}`;

  const valueY = stacked
    ? height * 0.38
    : settings.canvasHeight * 0.05 + settings.canvasHeight * 0.8 * 0.45;

  // Size each digit's slot from the font's own glyph advance width (not the
  // full segment width divided evenly) so the digits stay tightly grouped
  // and centered as a pair/trio instead of spreading across the whole
  // available row — this only depends on font metrics, never on which
  // specific digit is shown, so the anchor still never shifts on change.
  const digitWidth = ctx.measureText("0").width;
  const digitGap = digitWidth * 0.12;
  const totalWidth = digitWidth * charCount + digitGap * (charCount - 1);
  const startX = width / 2 - totalWidth / 2;
  const anchorX = startX + digitWidth / 2 + slotIndex * (digitWidth + digitGap);
  ctx.fillText(char, anchorX, valueY);

  return sampleCanvasPoints(ctx, width, height, settings.sampleStride, layout);
}

function drawLabelPoints(
  label: string,
  index: number,
  stacked: boolean,
  settings: CountdownSettings,
  labelFont: number
): SamplePoint[] {
  const layout = getSegmentLayout(index, stacked, settings);
  const width = Math.max(1, Math.ceil(layout.width));
  const height = Math.max(1, Math.ceil(layout.height));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return [];
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${labelFont}px ${LABEL_FONT_FAMILY}`;

  const labelY = stacked
    ? height * 0.8
    : settings.canvasHeight * 0.05 + settings.canvasHeight * 0.8 * 0.8;
  ctx.fillText(label, width / 2, labelY);

  // Deliberately not scaled directly off settings.sampleStride: that value
  // controls the big value-digit dot density, and labels are small text that
  // needs to stay dense to read regardless of how sparse the digits get.
  // Coverage-grid sampling (not per-pixel) keeps the small letterforms clean
  // and continuous; the threshold trades stroke thickness vs. legibility.
  const labelCell = Math.max(2, Math.round(settings.sampleStride * 0.32));
  return sampleLabelGrid(ctx, width, height, labelCell, layout, 0.22);
}

// Bumped up from 0.55 now that labels render in a single pass with no
// size-boosted glow layer to blend neighboring dots together — slightly
// bigger label dots keep letterforms legible without the old overlap.
const LABEL_SIZE_SCALE = 0.62;
const FLASH_SIZE_BOOST = 0.55;

// Cursor "magnifying glass" hover (inspired by the OpenAI Build Week
// countdown): near the cursor the dots swell (lens magnification), get pushed
// out of their slots (repel), and show a subtle red/cyan chromatic-aberration
// fringe (lens dispersion) — like screen pixels under a droplet of water.
// Three INDEPENDENT radii so each can be tuned on its own; the repel radius
// lives in the useFrame loop (see repelRadius).
const MAGNIFY_RADIUS = 0.7; // where dots swell in size
const MAGNIFY_BOOST = 1.9; // dot at the cursor is up to ~2.9x its base size
const CHROMA_RADIUS = 1.0; // where the RGB lens-fringe shows (kept tighter → subtle)
const CHROMA_AMOUNT = 0.23; // max RGB split, in sprite-space fraction (0..1)
const CHROMA_RED_LIFT = 0.67; // how much red to add under the cursor so the fringe reads

// The device pixel ratio the dot sizes are tuned against. gl_PointSize is
// scaled by (actualPixelRatio / REFERENCE_DPR) so a dot keeps the same
// on-screen size regardless of the display's DPR, the browser zoom, or
// whether AdaptiveDpr has lowered the render resolution. 1.5 matches a
// typical laptop; nudge this one value if dots read a touch large/small.
const REFERENCE_DPR = 1.5;

// Damped-spring constants for how a dot returns to rest after being
// repelled or reassigned to a new target. Higher stiffness pulls harder;
// higher damping resists faster, cutting down overshoot. The ratio between
// them controls the "bounce" — see the useFrame loop below. Stiffness scales
// with the square of damping (not linearly) to speed up settle time while
// keeping the same damping ratio, i.e. the same amount of bounce, just faster.
const SPRING_STIFFNESS = 330;
const SPRING_DAMPING = 27;
const SPRING_STIFFNESS_REDUCED = 176;
const SPRING_DAMPING_REDUCED = 39;
const MAX_SPRING_DT = 1 / 30;

const PALETTE_RGB = PALETTE.map(
  (hex) =>
    [
      Number.parseInt(hex.slice(1, 3), 16) / 255,
      Number.parseInt(hex.slice(3, 5), 16) / 255,
      Number.parseInt(hex.slice(5, 7), 16) / 255,
    ] as const
);

type Target = {
  x: number;
  y: number;
  z: number;
  density: number;
  tone: readonly [number, number, number];
};

function buildTarget(point: SamplePoint, settings: CountdownSettings): Target {
  const width = settings.canvasWidth;
  const height = settings.canvasHeight;
  const normalizedX = point.x / width;
  const normalizedY = point.y / height;
  const density = Math.min(1, Math.max(0, point.alpha / 255));
  const centerWeight =
    1 - Math.min(1, Math.abs(normalizedX - 0.5) * 1.5 + Math.abs(normalizedY - 0.5) * 0.8);

  // Seeded from pixel location (not particle index) so tone/depth stay
  // stable for a given screen position regardless of which particle
  // ends up occupying it after nearest-neighbor reassignment.
  const seed = point.x * 131 + point.y * 977;
  const toneRoll = hash01(seed + 23);
  const toneIndex = density > 0.72 || centerWeight > 0.55 ? 0 : toneRoll > 0.55 ? 1 : 2;

  return {
    x: (normalizedX - 0.5) * settings.sceneWidth,
    y: (0.5 - normalizedY) * settings.sceneHeight + settings.sceneOffsetY,
    z: (hash01(seed + 19) - 0.5) * 0.02,
    density,
    tone: PALETTE_RGB[toneIndex],
  };
}

function writeTargetIntoArrays(
  target: Target,
  settings: CountdownSettings,
  sizeScale: number,
  poolIndex: number,
  basePositions: Float32Array,
  colors: Float32Array,
  sizes: Float32Array,
  baseSizes: Float32Array
) {
  const offset = poolIndex * 3;
  basePositions[offset] = target.x;
  basePositions[offset + 1] = target.y;
  basePositions[offset + 2] = target.z;

  colors[offset] = target.tone[0];
  colors[offset + 1] = target.tone[1];
  colors[offset + 2] = target.tone[2];

  const size =
    (settings.pointSizeMin + target.density * (settings.pointSizeMax - settings.pointSizeMin)) * sizeScale;
  sizes[poolIndex] = size;
  baseSizes[poolIndex] = size;
}

// Greedy nearest-neighbor matching: each pooled particle claims the closest
// still-unclaimed target, using a spatial hash so particles move the least
// distance necessary to reform the new digit instead of jumping to an
// arbitrary raster-order slot.
function assignNearestTargets(
  currentPositions: Float32Array,
  poolOffset: number,
  poolCount: number,
  targets: Target[],
  cellSize: number
): Int32Array {
  const assignment = new Int32Array(poolCount);
  const targetCount = targets.length;
  if (targetCount === 0 || poolCount === 0) {
    return assignment;
  }

  const size = Math.max(cellSize, 0.001);
  const buckets = new Map<string, number[]>();
  for (let t = 0; t < targetCount; t += 1) {
    const key = `${Math.floor(targets[t].x / size)},${Math.floor(targets[t].y / size)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(t);
    } else {
      buckets.set(key, [t]);
    }
  }

  const claimed = new Uint8Array(targetCount);
  const primaryCount = Math.min(poolCount, targetCount);

  for (let i = 0; i < primaryCount; i += 1) {
    const offset = (poolOffset + i) * 3;
    const px = currentPositions[offset];
    const py = currentPositions[offset + 1];
    const cx = Math.floor(px / size);
    const cy = Math.floor(py / size);

    let best = -1;
    let bestDist = Infinity;

    for (let ring = 0; ring <= 8 && best === -1; ring += 1) {
      for (let gx = cx - ring; gx <= cx + ring; gx += 1) {
        for (let gy = cy - ring; gy <= cy + ring; gy += 1) {
          const bucket = buckets.get(`${gx},${gy}`);
          if (!bucket) {
            continue;
          }
          for (let b = 0; b < bucket.length; b += 1) {
            const t = bucket[b];
            if (claimed[t]) {
              continue;
            }
            const dx = targets[t].x - px;
            const dy = targets[t].y - py;
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) {
              bestDist = dist;
              best = t;
            }
          }
        }
      }
    }

    if (best === -1) {
      for (let t = 0; t < targetCount; t += 1) {
        if (claimed[t]) {
          continue;
        }
        const dx = targets[t].x - px;
        const dy = targets[t].y - py;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = t;
        }
      }
    }

    assignment[i] = best === -1 ? 0 : best;
    if (best !== -1) {
      claimed[best] = 1;
    }
  }

  for (let i = primaryCount; i < poolCount; i += 1) {
    assignment[i] = i % targetCount;
  }

  return assignment;
}

function CountdownDigitGroup({
  value,
  label,
  index,
  stacked,
  settings,
  sceneOffsetY,
  valueFont,
  labelFont,
  waveXFrequency,
  waveYFrequency,
  reducedMotion,
  pointerWorld,
}: {
  value: string;
  label: string;
  index: number;
  stacked: boolean;
  settings: CountdownSettings;
  sceneOffsetY: number;
  valueFont: number;
  labelFont: number;
  waveXFrequency: number;
  waveYFrequency: number;
  reducedMotion: boolean;
  pointerWorld: MutableRefObject<Vector3>;
}) {
  const [geometry] = useState(() => new BufferGeometry());
  const positionAttributeRef = useRef<BufferAttribute | null>(null);
  const materialRef = useRef<ShaderMaterial>(null!);
  const systemRef = useRef<ParticleSystem | null>(null);
  const structuralKeyRef = useRef<string>("");
  const charPoolRef = useRef<{ offsets: number[]; sizes: number[]; chars: string[] } | null>(null);
  const charFlashRef = useRef<number[]>([]);
  const settleCompleteRef = useRef(false);

  const poolSize = useMemo(
    () => Math.max(1, Math.ceil(settings.maxParticles / 4)),
    [settings.maxParticles]
  );

  // Structural setup: (re)allocates the pool, samples the (static) label
  // text once, and gives each digit position its own reserved slot range
  // within the pool so a digit's dots can never be matched to a different
  // digit position's targets.
  useEffect(() => {
    const chars = value.split("");
    const charCount = chars.length;
    const structuralKey = `${poolSize}|${settings.canvasWidth}|${settings.canvasHeight}|${settings.sceneWidth}|${settings.sceneHeight}|${sceneOffsetY}|${stacked}|${labelFont}|${valueFont}|${charCount}`;
    if (systemRef.current && structuralKeyRef.current === structuralKey) {
      return;
    }
    structuralKeyRef.current = structuralKey;

    const settingsWithOffset = { ...settings, sceneOffsetY };
    const labelPoints = drawLabelPoints(label, index, stacked, settings, labelFont);
    const labelTargets = labelPoints.map((point) => buildTarget(point, settingsWithOffset));
    const labelCount = Math.min(labelTargets.length, poolSize - charCount);

    const valuePoolSize = Math.max(charCount, poolSize - labelCount);
    const charPoolSizes = chars.map(
      (_, i) =>
        Math.floor(((i + 1) * valuePoolSize) / charCount) - Math.floor((i * valuePoolSize) / charCount)
    );
    const charPoolOffsets: number[] = [];
    let offsetAcc = labelCount;
    for (const size of charPoolSizes) {
      charPoolOffsets.push(offsetAcc);
      offsetAcc += size;
    }

    const positions = new Float32Array(poolSize * 3);
    const velocities = new Float32Array(poolSize * 3);
    const basePositions = new Float32Array(poolSize * 3);
    const colors = new Float32Array(poolSize * 3);
    const sizes = new Float32Array(poolSize);
    const baseSizes = new Float32Array(poolSize);

    for (let i = 0; i < labelCount; i += 1) {
      writeTargetIntoArrays(labelTargets[i], settings, LABEL_SIZE_SCALE, i, basePositions, colors, sizes, baseSizes);
    }

    chars.forEach((char, charIndex) => {
      const charPoolSize = charPoolSizes[charIndex];
      const charPoints = drawCharacterPoints(char, charIndex, charCount, index, stacked, settings, valueFont);
      const charTargets = reduceSamplePoints(charPoints, charPoolSize).map((point) =>
        buildTarget(point, settingsWithOffset)
      );
      const sampleCount = charTargets.length;

      for (let i = 0; i < charPoolSize; i += 1) {
        const target =
          sampleCount > 0
            ? charTargets[i % sampleCount]
            : { x: 0, y: sceneOffsetY, z: 0, density: 0, tone: PALETTE_RGB[2] };
        writeTargetIntoArrays(
          target,
          settings,
          1,
          charPoolOffsets[charIndex] + i,
          basePositions,
          colors,
          sizes,
          baseSizes
        );
      }
    });

    positions.set(basePositions);
    systemRef.current = { positions, velocities, basePositions, colors, sizes, baseSizes, count: poolSize };
    charPoolRef.current = { offsets: charPoolOffsets, sizes: charPoolSizes, chars: chars.slice() };
    charFlashRef.current = chars.map(() => 0);

    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    positionAttributeRef.current = geometry.getAttribute("position") as BufferAttribute;
    geometry.computeBoundingSphere();
  }, [poolSize, settings, sceneOffsetY, stacked, labelFont, label, index, value, valueFont, geometry]);

  // Digit ticks: only the digit position(s) whose character actually
  // changed get resampled and reassigned (nearest-neighbor, within that
  // digit's own pool range only) — an unchanged digit's dots never move.
  useEffect(() => {
    const system = systemRef.current;
    const charPool = charPoolRef.current;
    if (!system || !charPool) {
      return;
    }

    const chars = value.split("");
    if (chars.length !== charPool.chars.length) {
      return;
    }

    const settingsWithOffset = { ...settings, sceneOffsetY };
    const worldStride = (settings.sceneWidth / settings.canvasWidth) * settings.sampleStride;
    const cellSize = Math.max(worldStride * 1.5, 0.01);
    let changed = false;

    chars.forEach((char, charIndex) => {
      if (char === charPool.chars[charIndex]) {
        return;
      }
      changed = true;
      charPool.chars[charIndex] = char;

      const poolOffset = charPool.offsets[charIndex];
      const poolCount = charPool.sizes[charIndex];

      const charPoints = drawCharacterPoints(char, charIndex, chars.length, index, stacked, settings, valueFont);
      const charTargets = reduceSamplePoints(charPoints, poolCount).map((point) =>
        buildTarget(point, settingsWithOffset)
      );
      if (charTargets.length === 0) {
        return;
      }

      const assignment = assignNearestTargets(system.positions, poolOffset, poolCount, charTargets, cellSize);
      for (let i = 0; i < poolCount; i += 1) {
        const target = charTargets[assignment[i]];
        writeTargetIntoArrays(
          target,
          settings,
          1,
          poolOffset + i,
          system.basePositions,
          system.colors,
          system.sizes,
          system.baseSizes
        );
      }

      // Only this digit's slot range gets a flash pulse — the sibling
      // digit (and label) that didn't change stays completely still.
      charFlashRef.current[charIndex] = 1;
    });

    if (!changed) {
      return;
    }

    settleCompleteRef.current = false;

    const colorAttribute = geometry.getAttribute("aColor") as BufferAttribute;
    colorAttribute.needsUpdate = true;
  }, [value, index, stacked, settings, sceneOffsetY, valueFont, geometry]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame((state, delta) => {
    const current = systemRef.current;
    if (!current) {
      return;
    }
    const dt = Math.min(delta, MAX_SPRING_DT);
    const t = state.clock.elapsedTime;
    const pointer = pointerWorld.current;
    // pointerWorld is parked at x=999 when the cursor is off the canvas; a real
    // scene x is within ~±11, so this cheaply means "cursor is over the timer".
    const pointerNear = pointer.x < 500;
    const repelRadius = reducedMotion ? 0.62 : 1.25;
    const repelStrength = reducedMotion ? 0.3 : 0.85;
    const stiffness = reducedMotion ? SPRING_STIFFNESS_REDUCED : SPRING_STIFFNESS;
    const damping = reducedMotion ? SPRING_DAMPING_REDUCED : SPRING_DAMPING;

    // Hover = repel (dots pushed out of their grid slot in the spring loop
    // below) + a shader spotlight (size/brightness via uPointer). Keep the loop
    // awake while the cursor is over the timer so the repel actually animates.
    if (pointerNear) {
      settleCompleteRef.current = false;
    }

    // Per-digit flash: only the slot range belonging to the digit that just
    // changed gets a brief size pop, decaying back to its resting size.
    // The sibling digit (and the label) are never touched, so only the
    // digit that actually ticked visibly reacts.
    const charPool = charPoolRef.current;
    const charFlash = charFlashRef.current;
    let flashActive = false;
    let sizesDirty = false;

    if (charPool) {
      for (let c = 0; c < charFlash.length; c += 1) {
        const offset = charPool.offsets[c];
        const count = charPool.sizes[c];

        if (charFlash[c] > 0.004) {
          charFlash[c] *= 0.7;
          flashActive = true;
          sizesDirty = true;
          const boost = 1 + charFlash[c] * FLASH_SIZE_BOOST;
          for (let i = offset; i < offset + count; i += 1) {
            current.sizes[i] = current.baseSizes[i] * boost;
          }
        } else if (charFlash[c] !== 0) {
          charFlash[c] = 0;
          sizesDirty = true;
          for (let i = offset; i < offset + count; i += 1) {
            current.sizes[i] = current.baseSizes[i];
          }
        }
      }
    }

    if (sizesDirty) {
      const sizeAttribute = geometry.getAttribute("aSize") as BufferAttribute;
      sizeAttribute.needsUpdate = true;
    }

    const dprScale = state.gl.getPixelRatio() / REFERENCE_DPR;

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = t;
      materialRef.current.uniforms.uPointScale.value = settings.pointScale;
      materialRef.current.uniforms.uOpacity.value = settings.dotOpacity;
      materialRef.current.uniforms.uDprScale.value = dprScale;
      materialRef.current.uniforms.uSceneWidth.value = settings.sceneWidth;
      materialRef.current.uniforms.uSceneHeight.value = settings.sceneHeight;
      materialRef.current.uniforms.uWaveXFrequency.value = waveXFrequency;
      materialRef.current.uniforms.uWaveYFrequency.value = waveYFrequency;
      const hoverPointer = materialRef.current.uniforms.uPointer.value as number[];
      hoverPointer[0] = pointer.x;
      hoverPointer[1] = pointer.y;
    }

    if (settleCompleteRef.current && !flashActive) {
      return;
    }

    const posThreshold = 0.0003;
    const velThreshold = 0.02;
    let maxPosDelta = 0;
    let maxVel = 0;

    for (let i = 0; i < current.count; i += 1) {
      const offset = i * 3;
      const oy = offset + 1;
      const oz = offset + 2;
      const baseX = current.basePositions[offset];
      const baseY = current.basePositions[oy];
      const baseZ = current.basePositions[oz];

      let desiredX = baseX;
      let desiredY = baseY;
      let desiredZ = baseZ;

      if (pointerNear) {
        const dx = baseX - pointer.x;
        const dy = baseY - pointer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < repelRadius) {
          // Power curve concentrates the push near the cursor itself rather
          // than spreading it evenly across the whole radius. Layers under the
          // shader spotlight so the pushed-out dots also scale up and brighten.
          const influence = Math.pow(1 - distance / repelRadius, 1.4);
          const inverse = 1 / Math.max(distance, 0.0001);
          desiredX += dx * inverse * influence * repelStrength;
          desiredY += dy * inverse * influence * repelStrength;
          desiredZ += (hash01(i * 19 + t * 2.5) - 0.5) * influence * 0.07;
        }
      }

      // Per-particle jitter on the spring constants so the field doesn't
      // move as one rigid block — some dots pull back slightly quicker or
      // slower, and settle with a touch more or less bounce.
      const jitter = 0.85 + hash01(i * 37 + 131) * 0.3;
      const particleStiffness = stiffness * jitter;
      const particleDamping = damping * jitter;

      const ax = (desiredX - current.positions[offset]) * particleStiffness - current.velocities[offset] * particleDamping;
      const ay = (desiredY - current.positions[oy]) * particleStiffness - current.velocities[oy] * particleDamping;
      const az = (desiredZ - current.positions[oz]) * particleStiffness - current.velocities[oz] * particleDamping;

      const vx = current.velocities[offset] + ax * dt;
      const vy = current.velocities[oy] + ay * dt;
      const vz = current.velocities[oz] + az * dt;

      current.velocities[offset] = vx;
      current.velocities[oy] = vy;
      current.velocities[oz] = vz;

      current.positions[offset] += vx * dt;
      current.positions[oy] += vy * dt;
      current.positions[oz] += vz * dt;

      maxPosDelta = Math.max(
        maxPosDelta,
        Math.abs(desiredX - current.positions[offset]),
        Math.abs(desiredY - current.positions[oy]),
        Math.abs(desiredZ - current.positions[oz])
      );
      maxVel = Math.max(maxVel, Math.abs(vx), Math.abs(vy), Math.abs(vz));
    }

    if (positionAttributeRef.current) {
      positionAttributeRef.current.needsUpdate = true;
    }

    if (maxPosDelta < posThreshold && maxVel < velThreshold && !flashActive) {
      settleCompleteRef.current = true;
    }
  });

  return (
    <group>
      <points geometry={geometry} renderOrder={2}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          uniforms={{
            uTime: { value: 0 },
            uPointScale: { value: settings.pointScale },
            uLayerScale: { value: 1 },
            uDprScale: { value: 1 },
            uOpacity: { value: settings.dotOpacity },
            uSoftness: { value: 0.5 },
            uGlowInner: { value: 0.08 },
            uGlowOuter: { value: 0.46 },
            uTwinkle: { value: 0.08 },
            uTintColor: { value: [0.4, 1, 1] },
            uSceneWidth: { value: settings.sceneWidth },
            uSceneHeight: { value: settings.sceneHeight },
            uWaveXFrequency: { value: waveXFrequency },
            uWaveYFrequency: { value: waveYFrequency },
            // Far off-screen by default so nothing is "hovered" until the
            // pointer moves over the canvas and updates this each frame.
            uPointer: { value: [9999, 9999] },
            uMagnifyRadius: { value: MAGNIFY_RADIUS },
            uMagnifyBoost: { value: MAGNIFY_BOOST },
            uChromaRadius: { value: CHROMA_RADIUS },
            uChromaAmount: { value: CHROMA_AMOUNT },
            uChromaRedLift: { value: CHROMA_RED_LIFT },
          }}
        />
      </points>
    </group>
  );
}

function CountdownDigits({
  reducedMotion,
  quality,
  headerHeightPx,
  containerWidthPx,
  containerHeightPx,
  countdown,
}: {
  reducedMotion: boolean;
  quality: QualityTier;
  headerHeightPx: number;
  containerWidthPx: number;
  containerHeightPx: number;
  countdown: CountdownValue;
}) {
  const viewportWidth = useViewportWidth();
  const viewportHeight = useViewportHeight();
  const stacked = useStackedLayout();
  const cameraZ = stacked ? 8.15 : 7.35;
  const cameraFov = 42;
  const cameraViewportHeight = useMemo(
    () => 2 * cameraZ * Math.tan((cameraFov * Math.PI) / 360),
    [cameraZ]
  );
  const settings = useMemo(
    () =>
      getSettings(
        quality,
        stacked,
        viewportWidth,
        cameraZ,
        cameraFov,
        containerWidthPx,
        containerHeightPx
      ),
    [cameraFov, cameraZ, containerHeightPx, containerWidthPx, quality, stacked, viewportWidth]
  );
  const sceneOffsetY = useMemo(() => {
    const headerWorldHeight = pixelsToWorldUnits(
      headerHeightPx,
      viewportHeight,
      cameraViewportHeight
    );
    return settings.sceneOffsetY - headerWorldHeight * 0.08;
  }, [cameraViewportHeight, headerHeightPx, settings.sceneOffsetY, viewportHeight]);
  const pointerWorld = useRef(new Vector3(0, 0, 0));
  const hitPlaneScale = useMemo(
    () => [settings.sceneWidth, settings.sceneHeight, 1] as const,
    [settings.sceneHeight, settings.sceneWidth]
  );
  const waveXFrequency = useMemo(
    () => (Math.PI * 2 * 1.4) / Math.max(0.001, settings.sceneWidth),
    [settings.sceneWidth]
  );
  const waveYFrequency = useMemo(
    () => (Math.PI * 2 * 1.05) / Math.max(0.001, settings.sceneHeight),
    [settings.sceneHeight]
  );

  const [measureCtx] = useState<CanvasRenderingContext2D | null>(() =>
    typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d")
  );

  const values = useMemo(
    () => [countdown.days, countdown.hours, countdown.minutes, countdown.seconds] as const,
    [countdown.days, countdown.hours, countdown.minutes, countdown.seconds]
  );

  // The fitted font depends only on the longest value's LENGTH (Arial Black
  // digits are tabular / equal width), not on the specific digits — so key the
  // fit on that length, not on `values` which change every second, to avoid
  // re-running the binary-search measureText fit on every tick.
  const maxValueLength = useMemo(
    () => values.reduce((longest, value) => Math.max(longest, value.length), 1),
    [values]
  );

  const fonts = useMemo(() => {
    if (!measureCtx) {
      return { valueFont: settings.fontSize, labelFont: 28 };
    }
    // A representative all-'0' string of the longest length stands in for the
    // fit (same width as any real value of that length).
    const representative = "0".repeat(maxValueLength);
    return computeFontSizes(measureCtx, [representative], stacked, settings);
  }, [measureCtx, maxValueLength, stacked, settings]);

  useFrame((state) => {
    state.camera.position.z = MathUtils.lerp(state.camera.position.z, cameraZ, 0.06);
  });

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    pointerWorld.current.copy(event.point);
  };

  const handlePointerLeave = () => {
    // Park the pointer far off-screen so the shader's distance-based hover
    // falls to zero everywhere (no "active" flag needed).
    pointerWorld.current.set(999, 999, 999);
  };

  return (
    <group>
      <mesh
        position={[0, 0, 0]}
        scale={hitPlaneScale}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {values.map((value, index) => (
        <CountdownDigitGroup
          key={index}
          index={index}
          value={value}
          label={SEGMENT_LABELS[index]}
          stacked={stacked}
          settings={settings}
          sceneOffsetY={sceneOffsetY}
          valueFont={fonts.valueFont}
          labelFont={fonts.labelFont}
          waveXFrequency={waveXFrequency}
          waveYFrequency={waveYFrequency}
          reducedMotion={reducedMotion}
          pointerWorld={pointerWorld}
        />
      ))}
    </group>
  );
}

export function CountdownScene({
  active,
  reducedMotion,
  quality,
  headerHeightPx,
  containerWidthPx,
  containerHeightPx,
  countdown,
}: CountdownSceneProps) {
  const safeCountdown = useMemo(
    () => countdown ?? { days: "00", hours: "00", minutes: "00", seconds: "00" },
    [countdown]
  );
  // Low tier gets a higher DPR than before (1.4 vs 1) for crisper mobile
  // digits; the much smaller glow footprint keeps total fill rate well below
  // where it was, so this is a net win on both looks and performance.
  const dprCap = quality === "high" ? 1.75 : quality === "medium" ? 1.5 : 1.4;

  return (
    <Canvas
      dpr={[1, dprCap]}
      frameloop={active ? "always" : "demand"}
      gl={{
        alpha: true,
        antialias: quality !== "low",
        depth: true,
        stencil: false,
        powerPreference: "high-performance",
      }}
      camera={{ position: [0, 0, 7.35], fov: 42 }}
      className="h-full w-full"
      style={{ touchAction: "pan-y" }}
    >
      <color attach="background" args={["#030303"]} />
      <ambientLight intensity={1.25} />
      <directionalLight position={[4, 6, 8]} intensity={1.7} color="#f4f4f4" />
      <directionalLight position={[-4, -2, -4]} intensity={0.55} color="#b9b9b9" />
      <AdaptiveDpr pixelated={quality === "low"} />
      <AdaptiveEvents />
      <CountdownDigits
        reducedMotion={reducedMotion}
        quality={quality}
        headerHeightPx={headerHeightPx}
        containerWidthPx={containerWidthPx}
        containerHeightPx={containerHeightPx}
        countdown={safeCountdown}
      />
    </Canvas>
  );
}
