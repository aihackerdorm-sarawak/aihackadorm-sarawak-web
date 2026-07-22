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
uniform float uSceneWidth;
uniform float uSceneHeight;
uniform float uWaveXFrequency;
uniform float uWaveYFrequency;

void main() {
  vColor = aColor;
  vSeed = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);

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

  gl_PointSize = aSize * uPointScale * uLayerScale * perspective;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
varying vec3 vColor;
varying float vSeed;

uniform float uTime;
uniform float uOpacity;
uniform float uSoftness;
uniform float uGlowInner;
uniform float uGlowOuter;
uniform float uTwinkle;
uniform vec3 uTintColor;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);
  float glow = 1.0 - smoothstep(uGlowInner, uGlowOuter, dist);
  float core = 1.0 - smoothstep(0.0, 0.42, dist);
  float alpha = mix(core, core * 0.6 + glow * 0.4, uSoftness);

  float twinkle = 1.0 + sin(uTime * 3.7 + vSeed * 6.28318) * uTwinkle;

  gl_FragColor = vec4(vColor * uTintColor, alpha * uOpacity * twinkle);
}
`;

const PALETTE = ["#ffffff", "#f0f0f0", "#cacaca"] as const;

function hash01(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function useViewportWidth() {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 1024 : window.innerWidth
  );

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return width;
}

function useViewportHeight() {
  const [height, setHeight] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight
  );

  useEffect(() => {
    const update = () => setHeight(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
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
  const layoutScale = stacked ? 0.85 : 0.90;
  const particleScale = quality === "high" ? 1.02 : quality === "medium" ? 0.98 : 0.94;

  if (quality === "high") {
    return {
      canvasWidth: 1500,
      canvasHeight: 380,
      fontSize: stacked ? 128 : 138,
      layoutScale,
      sceneWidth: visibleWidth * layoutScale,
      sceneHeight: visibleHeight * layoutScale,
      sceneOffsetY: stacked ? -0.18 : -0.06,
      pointSizeMin: 0.032 * viewportScale * particleScale,
      pointSizeMax: 0.062 * viewportScale * particleScale,
      pointScale: 3.9 * viewportScale * particleScale,
      sampleStride: stacked ? 8 : 8,
      maxParticles: stacked ? 4400 : 6200,
    };
  }

  if (quality === "low") {
    return {
      canvasWidth: stacked ? 760 : 1120,
      canvasHeight: stacked ? 860 : 280,
      fontSize: stacked ? 112 : 122,
      layoutScale,
      sceneWidth: visibleWidth * layoutScale,
      sceneHeight: visibleHeight * layoutScale,
      sceneOffsetY: stacked ? -0.17 : -0.06,
      pointSizeMin: 0.026 * viewportScale * particleScale,
      pointSizeMax: 0.05 * viewportScale * particleScale,
      pointScale: 3.1 * viewportScale * particleScale,
      sampleStride: stacked ? 10 : 10,
      maxParticles: stacked ? 2600 : 3600,
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
    sampleStride: stacked ? 8 : 8,
    maxParticles: stacked ? 3700 : 5200,
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

const SEGMENT_LABELS = ["DAYS", "HOURS", "MINS", "SECS"] as const;

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
    const rowHeight = settings.canvasHeight / 4;
    const maxTextWidth = settings.canvasWidth * 0.6;
    const maxTextHeight = rowHeight * 0.45;

    const valueFont = fitTextFontSize(
      ctx,
      longestValue,
      maxTextWidth,
      maxTextHeight,
      48,
      Math.max(90, Math.round(settings.fontSize * 1.1))
    );
    const labelFont = fitTextFontSize(ctx, "HOURS", settings.canvasWidth * 0.4, rowHeight * 0.15, 16, 36);

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
  const labelFont = fitTextFontSize(ctx, "HOURS", cardWidth * 0.64, cardHeight * 0.22, 20, 42);

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
  ctx.font = `500 ${labelFont}px ${COUNTDOWN_FONT_FAMILY}`;

  const labelY = stacked
    ? height * 0.8
    : settings.canvasHeight * 0.05 + settings.canvasHeight * 0.8 * 0.8;
  ctx.fillText(label, width / 2, labelY);

  const labelStride = Math.max(2, Math.round(settings.sampleStride * 0.45));
  return sampleCanvasPoints(ctx, width, height, labelStride, layout);
}

const LABEL_SIZE_SCALE = 0.55;
const FLASH_SIZE_BOOST = 0.55;

// Damped-spring constants for how a dot returns to rest after being
// repelled or reassigned to a new target. Higher stiffness pulls harder;
// higher damping resists faster, cutting down overshoot. The ratio between
// them controls the "bounce" — see the useFrame loop below.
const SPRING_STIFFNESS = 170;
const SPRING_DAMPING = 19;
const SPRING_STIFFNESS_REDUCED = 90;
const SPRING_DAMPING_REDUCED = 28;
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
  pointerActive,
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
  pointerActive: MutableRefObject<boolean>;
}) {
  const [geometry] = useState(() => new BufferGeometry());
  const positionAttributeRef = useRef<BufferAttribute | null>(null);
  const glowMaterialRef = useRef<ShaderMaterial>(null!);
  const coreMaterialRef = useRef<ShaderMaterial>(null!);
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
    const repelRadius = reducedMotion ? 0.4 : 0.68;
    const repelStrength = reducedMotion ? 0.14 : 0.34;
    const stiffness = reducedMotion ? SPRING_STIFFNESS_REDUCED : SPRING_STIFFNESS;
    const damping = reducedMotion ? SPRING_DAMPING_REDUCED : SPRING_DAMPING;

    if (pointerActive.current) {
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

    if (glowMaterialRef.current) {
      glowMaterialRef.current.uniforms.uTime.value = t;
      glowMaterialRef.current.uniforms.uPointScale.value = settings.pointScale;
      glowMaterialRef.current.uniforms.uSceneWidth.value = settings.sceneWidth;
      glowMaterialRef.current.uniforms.uSceneHeight.value = settings.sceneHeight;
      glowMaterialRef.current.uniforms.uWaveXFrequency.value = waveXFrequency;
      glowMaterialRef.current.uniforms.uWaveYFrequency.value = waveYFrequency;
    }

    if (coreMaterialRef.current) {
      coreMaterialRef.current.uniforms.uTime.value = t;
      coreMaterialRef.current.uniforms.uPointScale.value = settings.pointScale;
      coreMaterialRef.current.uniforms.uSceneWidth.value = settings.sceneWidth;
      coreMaterialRef.current.uniforms.uSceneHeight.value = settings.sceneHeight;
      coreMaterialRef.current.uniforms.uWaveXFrequency.value = waveXFrequency;
      coreMaterialRef.current.uniforms.uWaveYFrequency.value = waveYFrequency;
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

      if (pointerActive.current) {
        const dx = baseX - pointer.x;
        const dy = baseY - pointer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < repelRadius) {
          // Power curve concentrates the push near the cursor itself
          // rather than spreading it evenly across the whole radius.
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

    if (!pointerActive.current && maxPosDelta < posThreshold && maxVel < velThreshold && !flashActive) {
      settleCompleteRef.current = true;
    }
  });

  return (
    <group>
      <points geometry={geometry} renderOrder={2}>
        <shaderMaterial
          ref={glowMaterialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          uniforms={{
            uTime: { value: 0 },
            uPointScale: { value: settings.pointScale },
            uLayerScale: { value: 1.9 },
            uOpacity: { value: 0.32 },
            uSoftness: { value: 1 },
            uGlowInner: { value: 0.05 },
            uGlowOuter: { value: 0.5 },
            uTwinkle: { value: 0.07 },
            uTintColor: { value: [0.93, 0.97, 1] },
            uSceneWidth: { value: settings.sceneWidth },
            uSceneHeight: { value: settings.sceneHeight },
            uWaveXFrequency: { value: waveXFrequency },
            uWaveYFrequency: { value: waveYFrequency },
          }}
        />
      </points>

      <points geometry={geometry} renderOrder={3}>
        <shaderMaterial
          ref={coreMaterialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          uniforms={{
            uTime: { value: 0 },
            uPointScale: { value: settings.pointScale },
            uLayerScale: { value: 0.88 },
            uOpacity: { value: 0.96 },
            uSoftness: { value: 0 },
            uGlowInner: { value: 0.14 },
            uGlowOuter: { value: 0.5 },
            uTwinkle: { value: 0.03 },
            uTintColor: { value: [1, 1, 1] },
            uSceneWidth: { value: settings.sceneWidth },
            uSceneHeight: { value: settings.sceneHeight },
            uWaveXFrequency: { value: waveXFrequency },
            uWaveYFrequency: { value: waveYFrequency },
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
  const pointerActive = useRef(false);
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
  const pointerDebugCount = useRef(0);
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

  const fonts = useMemo(() => {
    if (!measureCtx) {
      return { valueFont: settings.fontSize, labelFont: 28 };
    }
    return computeFontSizes(measureCtx, values, stacked, settings);
  }, [measureCtx, values, stacked, settings]);

  useFrame((state) => {
    state.camera.position.z = MathUtils.lerp(state.camera.position.z, cameraZ, 0.06);
  });

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    pointerWorld.current.copy(event.point);
    pointerActive.current = true;

    if (pointerDebugCount.current < 8) {
      pointerDebugCount.current += 1;
      console.debug("[countdown pointer]", {
        point: event.point.toArray(),
        container: [containerWidthPx, containerHeightPx],
        scene: [settings.sceneWidth, settings.sceneHeight],
      });
    }
  };

  const handlePointerLeave = () => {
    pointerActive.current = false;
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
          pointerActive={pointerActive}
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
  const dprCap = quality === "high" ? 1.5 : quality === "medium" ? 1.25 : 1;

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
