"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Plane, Vector2, Vector3 } from "three";
import type { ShaderMaterial } from "three";

type QualityTier = "low" | "medium" | "high";

type CountdownValue = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

type GlyphPoint = [number, number];

type CountdownSettings = {
  digitResolution: number;
  colonResolution: number;
  digitSamples: number;
  colonSamples: number;
  digitWidth: number;
  digitHeight: number;
  digitWidthScale: number;
  digitStep: number;
  groupSpacingX: number;
  groupSpacingY: number;
  colonWidth: number;
  colonHeight: number;
  pointSizeMin: number;
  pointSizeMax: number;
  pointScale: number;
};

type ParticleSystem = {
  positions: Float32Array;
  targets: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  count: number;
};

type LayoutItem = {
  char: string;
  originX: number;
  originY: number;
  scaleX: number;
  scaleY: number;
  sampleCount: number;
};

type CountdownSceneProps = {
  active: boolean;
  reducedMotion: boolean;
  quality: QualityTier;
  headerHeightPx: number;
  countdown?: CountdownValue;
};

const vertexShader = `
attribute float aSize;
attribute vec3 aColor;

varying vec3 vColor;

uniform float uTime;
uniform float uPointScale;
uniform float uLayerScale;

void main() {
  vColor = aColor;

  vec3 displaced = position;
  displaced.z += sin(uTime * 0.8 + position.x * 1.25 + position.y * 0.9) * 0.012;
  displaced.x += sin(uTime * 0.35 + position.y * 1.1) * 0.0035;
  displaced.y += cos(uTime * 0.28 + position.x * 1.05) * 0.0025;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  float perspective = 245.0 / max(0.001, -mvPosition.z);

  gl_PointSize = aSize * uPointScale * uLayerScale * perspective;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
varying vec3 vColor;

uniform float uOpacity;
uniform float uSoftness;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);
  float glow = 1.0 - smoothstep(0.14, 0.5, dist);
  float core = 1.0 - smoothstep(0.0, 0.42, dist);
  float alpha = mix(core, core * 0.6 + glow * 0.4, uSoftness);

  gl_FragColor = vec4(vColor, alpha * uOpacity);
}
`;

const MONO_TONES = ["#ffffff", "#e0e0e0", "#9a9a9a"] as const;

function scaleWithViewport(value: number, viewportScale: number, influence: number) {
  return value * (1 + (viewportScale - 1) * influence);
}

function getSettings(quality: QualityTier, viewportScale = 1): CountdownSettings {
  if (quality === "high") {
    return {
      digitResolution: Math.round(scaleWithViewport(84, viewportScale, 0.28)),
      colonResolution: Math.round(scaleWithViewport(120, viewportScale, 0.34)),
      digitSamples: Math.round(scaleWithViewport(156, viewportScale, 0.08)),
      colonSamples: Math.round(scaleWithViewport(72, viewportScale, 0.06)),
      digitWidth: scaleWithViewport(0.56, viewportScale, 0.08),
      digitHeight: scaleWithViewport(0.94, viewportScale, 0.08),
      digitWidthScale: scaleWithViewport(1.34, viewportScale, 0.12),
      digitStep: scaleWithViewport(0.62, viewportScale, 0.82),
      groupSpacingX: scaleWithViewport(1.86, viewportScale, 0.84),
      groupSpacingY: scaleWithViewport(1.1, viewportScale, 0.18),
      colonWidth: scaleWithViewport(0.18, viewportScale, 0.05),
      colonHeight: scaleWithViewport(0.56, viewportScale, 0.05),
      pointSizeMin: scaleWithViewport(0.028, viewportScale, 0.08),
      pointSizeMax: scaleWithViewport(0.05, viewportScale, 0.08),
      pointScale: scaleWithViewport(3.9, viewportScale, 0.12),
    };
  }

  if (quality === "low") {
    return {
      digitResolution: Math.round(scaleWithViewport(48, viewportScale, 0.24)),
      colonResolution: Math.round(scaleWithViewport(88, viewportScale, 0.3)),
      digitSamples: Math.round(scaleWithViewport(104, viewportScale, 0.06)),
      colonSamples: Math.round(scaleWithViewport(52, viewportScale, 0.05)),
      digitWidth: scaleWithViewport(0.5, viewportScale, 0.06),
      digitHeight: scaleWithViewport(0.9, viewportScale, 0.06),
      digitWidthScale: scaleWithViewport(1.28, viewportScale, 0.1),
      digitStep: scaleWithViewport(0.58, viewportScale, 0.76),
      groupSpacingX: scaleWithViewport(1.7, viewportScale, 0.8),
      groupSpacingY: scaleWithViewport(1.0, viewportScale, 0.16),
      colonWidth: scaleWithViewport(0.16, viewportScale, 0.05),
      colonHeight: scaleWithViewport(0.48, viewportScale, 0.05),
      pointSizeMin: scaleWithViewport(0.024, viewportScale, 0.06),
      pointSizeMax: scaleWithViewport(0.042, viewportScale, 0.06),
      pointScale: scaleWithViewport(3.2, viewportScale, 0.1),
    };
  }

  return {
    digitResolution: Math.round(scaleWithViewport(68, viewportScale, 0.26)),
    colonResolution: Math.round(scaleWithViewport(104, viewportScale, 0.3)),
    digitSamples: Math.round(scaleWithViewport(130, viewportScale, 0.07)),
    colonSamples: Math.round(scaleWithViewport(60, viewportScale, 0.05)),
    digitWidth: scaleWithViewport(0.52, viewportScale, 0.06),
    digitHeight: scaleWithViewport(0.92, viewportScale, 0.06),
    digitWidthScale: scaleWithViewport(1.3, viewportScale, 0.1),
    digitStep: scaleWithViewport(0.6, viewportScale, 0.78),
    groupSpacingX: scaleWithViewport(1.78, viewportScale, 0.82),
    groupSpacingY: scaleWithViewport(1.04, viewportScale, 0.16),
    colonWidth: scaleWithViewport(0.17, viewportScale, 0.05),
    colonHeight: scaleWithViewport(0.5, viewportScale, 0.05),
    pointSizeMin: scaleWithViewport(0.026, viewportScale, 0.07),
    pointSizeMax: scaleWithViewport(0.046, viewportScale, 0.07),
    pointScale: scaleWithViewport(3.55, viewportScale, 0.11),
  };
}

function hash01(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function mixRgb(a: ReturnType<typeof hexToRgb>, b: ReturnType<typeof hexToRgb>, t: number) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

const TONE_RGB = MONO_TONES.map(hexToRgb);

function getParticleColor(seedA: number, seedB: number) {
  const toneRoll = hash01(seedA);
  const accentRoll = hash01(seedB);

  if (toneRoll < 0.52) {
    return TONE_RGB[0];
  }

  if (toneRoll < 0.84) {
    return mixRgb(TONE_RGB[0], TONE_RGB[1], 0.3 + accentRoll * 0.18);
  }

  return mixRgb(TONE_RGB[1], TONE_RGB[2], 0.22 + accentRoll * 0.18);
}

function sampleGlyphPositions(char: string, resolution: number, sampleCount: number, widthScale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Array.from({ length: sampleCount }, () => [0, 0] as GlyphPoint);
  }

  ctx.clearRect(0, 0, resolution, resolution);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, resolution, resolution);
  ctx.fillStyle = "#fff";
  ctx.font = `900 ${Math.round(resolution * 0.88)}px "Arial Black", "Segoe UI Black", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(resolution / 2, resolution / 2);
  ctx.scale(widthScale, 1);
  ctx.translate(-resolution / 2, -resolution / 2);
  ctx.fillText(char, resolution / 2, resolution / 2);
  ctx.restore();

  const { data } = ctx.getImageData(0, 0, resolution, resolution);
  const rawPoints: GlyphPoint[] = [];

  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const index = (y * resolution + x) * 4;
      const alpha = data[index + 3];
      const brightness = data[index] + data[index + 1] + data[index + 2];
      if (alpha > 180 && brightness > 500) {
        rawPoints.push([(x / resolution) * 2 - 1, -((y / resolution) * 2 - 1)]);
      }
    }
  }

  if (rawPoints.length === 0) {
    return Array.from({ length: sampleCount }, () => [0, 0] as GlyphPoint);
  }

  const sampled: GlyphPoint[] = [];
  const step = rawPoints.length / sampleCount;

  for (let index = 0; index < sampleCount; index += 1) {
    const source = rawPoints[Math.floor(index * step) % rawPoints.length] ?? rawPoints[0];
    sampled.push(source);
  }

  return sampled;
}

function buildGlyphCache(settings: CountdownSettings) {
  const cache: Record<string, GlyphPoint[]> = {};
  for (const char of "0123456789") {
    cache[char] = sampleGlyphPositions(
      char,
      settings.digitResolution,
      settings.digitSamples,
      settings.digitWidthScale
    );
  }

  cache[":"] = sampleGlyphPositions(":", settings.colonResolution, settings.colonSamples, 1.05);
  return cache;
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
    typeof window === "undefined" ? 768 : window.innerHeight
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
    const query = window.matchMedia("(max-width: 640px)");
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

function computeLayout(
  countdown: CountdownValue,
  settings: CountdownSettings,
  stacked: boolean,
  sceneOffsetY: number
) {
  const groups = [countdown.days, countdown.hours, countdown.minutes, countdown.seconds];
  const digitSpacing = settings.digitStep * settings.digitWidthScale;
  const stackOffsetY = sceneOffsetY + (stacked ? -1.1 : -0.55);

  const groupOrigins = stacked
    ? [1.5, 0.5, -0.5, -1.5].map((y) => ({
        x: 0,
        y: y * settings.groupSpacingY + stackOffsetY,
      }))
    : [-1.5, -0.5, 0.5, 1.5].map((x) => ({
        x: x * settings.groupSpacingX,
        y: stackOffsetY,
      }));

  const items: LayoutItem[] = [];

  groups.forEach((group, groupIndex) => {
    const origin = groupOrigins[groupIndex];
    const digits = group.split("");

    digits.forEach((digit, digitIndex) => {
      items.push({
        char: digit,
        originX: origin.x + (digitIndex === 0 ? -digitSpacing / 2 : digitSpacing / 2),
        originY: origin.y,
        scaleX: settings.digitWidth,
        scaleY: settings.digitHeight,
        sampleCount: settings.digitSamples,
      });
    });

    if (groupIndex < groupOrigins.length - 1) {
      const nextOrigin = groupOrigins[groupIndex + 1];
      items.push({
        char: ":",
        originX: stacked ? 0 : (origin.x + nextOrigin.x) / 2,
        originY: origin.y,
        scaleX: settings.colonWidth,
        scaleY: settings.colonHeight,
        sampleCount: settings.colonSamples,
      });
    }
  });

  return items;
}

function getPresentationScale(viewportWidth: number) {
  if (viewportWidth >= 1440) return 1.08;
  if (viewportWidth >= 1024) return 1.04;
  if (viewportWidth < 640) return 0.96;
  return 1;
}

function createSystem(
  countdown: CountdownValue,
  settings: CountdownSettings,
  glyphCache: Record<string, GlyphPoint[]>,
  stacked: boolean,
  sceneOffsetY: number
) {
  const layout = computeLayout(countdown, settings, stacked, sceneOffsetY);
  const count = layout.reduce((total, item) => total + item.sampleCount, 0);
  const positions = new Float32Array(count * 3);
  const targets = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  let particleOffset = 0;

  layout.forEach((item, itemIndex) => {
    const glyph = glyphCache[item.char] ?? glyphCache["0"];

    for (let particleIndex = 0; particleIndex < item.sampleCount; particleIndex += 1) {
      const point = glyph[particleIndex % glyph.length] ?? [0, 0];
      const seed = itemIndex * 997 + particleIndex * 53 + item.char.charCodeAt(0) * 13;
      const offset = (particleOffset + particleIndex) * 3;
      const sizeIndex = particleOffset + particleIndex;

      const targetX = item.originX + point[0] * item.scaleX;
      const targetY = item.originY + point[1] * item.scaleY;
      const targetZ = (hash01(seed + 19) - 0.5) * 0.03;

      targets[offset] = targetX;
      targets[offset + 1] = targetY;
      targets[offset + 2] = targetZ;

      const settleX = (hash01(seed) - 0.5) * 0.18;
      const settleY = (hash01(seed + 7) - 0.5) * 0.18;
      const settleZ = (hash01(seed + 13) - 0.5) * 0.05;

      positions[offset] = targetX + settleX;
      positions[offset + 1] = targetY + settleY;
      positions[offset + 2] = targetZ + settleZ;

      const color = getParticleColor(seed + 23, seed + 41);
      colors[offset] = color.r / 255;
      colors[offset + 1] = color.g / 255;
      colors[offset + 2] = color.b / 255;

      sizes[sizeIndex] =
        settings.pointSizeMin +
        hash01(seed + 59) * (settings.pointSizeMax - settings.pointSizeMin) +
        (item.char === ":" ? -0.003 : 0);
    }

    particleOffset += item.sampleCount;
  });

  return { positions, targets, colors, sizes, count };
}

function CountdownParticles({
  reducedMotion,
  quality,
  pointerTarget,
  pointerNdc,
  pointerActive,
  headerHeightPx,
  countdown,
}: {
  reducedMotion: boolean;
  quality: QualityTier;
  pointerTarget: MutableRefObject<Vector3>;
  pointerNdc: MutableRefObject<Vector2>;
  pointerActive: MutableRefObject<boolean>;
  headerHeightPx: number;
  countdown: CountdownValue;
}) {
  const [geometry] = useState(() => new BufferGeometry());
  const positionAttributeRef = useRef<BufferAttribute | null>(null);
  const glowMaterialRef = useRef<ShaderMaterial>(null!);
  const coreMaterialRef = useRef<ShaderMaterial>(null!);
  const pointerPlane = useMemo(() => new Plane(new Vector3(0, 0, 1), 0), []);
  const viewportWidth = useViewportWidth();
  const viewportHeight = useViewportHeight();
  const stacked = useStackedLayout();
  const cameraZ = stacked ? 8.05 : 7.1;
  const cameraFov = 42;
  const cameraViewportHeight = useMemo(
    () => 2 * cameraZ * Math.tan((cameraFov * Math.PI) / 360),
    [cameraZ]
  );
  const sceneOffsetY = useMemo(() => {
    const headerWorldHeight = pixelsToWorldUnits(headerHeightPx, viewportHeight, cameraViewportHeight);
    return -(headerWorldHeight / 2) - 0.35;
  }, [cameraViewportHeight, headerHeightPx, viewportHeight]);
  const presentationScale = useMemo(() => getPresentationScale(viewportWidth), [viewportWidth]);
  const settings = useMemo(() => getSettings(quality, presentationScale), [quality, presentationScale]);
  const glyphCache = useMemo(() => buildGlyphCache(settings), [settings]);
  const safeCountdown = useMemo(
    () => countdown ?? { days: "00", hours: "00", minutes: "00", seconds: "00" },
    [countdown]
  );
  const [system, setSystem] = useState<ParticleSystem>(() =>
    createSystem(safeCountdown, settings, glyphCache, stacked, sceneOffsetY)
  );
  const systemRef = useRef(system);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSystem(createSystem(safeCountdown, settings, glyphCache, stacked, sceneOffsetY));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [glyphCache, safeCountdown, sceneOffsetY, settings, stacked]);

  useEffect(() => {
    systemRef.current = system;
    geometry.setAttribute("position", new BufferAttribute(system.positions, 3));
    geometry.setAttribute("aColor", new BufferAttribute(system.colors, 3));
    geometry.setAttribute("aSize", new BufferAttribute(system.sizes, 1));
    positionAttributeRef.current = geometry.getAttribute("position") as BufferAttribute;
  }, [geometry, system]);

  useEffect(() => {
    const current = systemRef.current;
    const layout = computeLayout(safeCountdown, settings, stacked, sceneOffsetY);
    let particleOffset = 0;

    layout.forEach((item, itemIndex) => {
      const glyph = glyphCache[item.char] ?? glyphCache["0"];

      for (let particleIndex = 0; particleIndex < item.sampleCount; particleIndex += 1) {
        const point = glyph[particleIndex % glyph.length] ?? [0, 0];
        const offset = (particleOffset + particleIndex) * 3;

        current.targets[offset] = item.originX + point[0] * item.scaleX;
        current.targets[offset + 1] = item.originY + point[1] * item.scaleY;
        current.targets[offset + 2] = (hash01(itemIndex * 313 + particleIndex * 17) - 0.5) * 0.03;
      }

      particleOffset += item.sampleCount;
    });
  }, [glyphCache, safeCountdown, sceneOffsetY, settings, stacked]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame((state) => {
    const current = systemRef.current;
    const pointer = pointerTarget.current;
    const repelRadius = reducedMotion ? 0.2 : 0.28;
    const repelStrength = reducedMotion ? 0.09 : 0.15;
    const damp = reducedMotion ? 0.09 : 0.14;

    if (glowMaterialRef.current) {
      glowMaterialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      glowMaterialRef.current.uniforms.uPointScale.value = settings.pointScale;
    }

    if (coreMaterialRef.current) {
      coreMaterialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      coreMaterialRef.current.uniforms.uPointScale.value = settings.pointScale;
    }

    state.camera.position.z += (cameraZ - state.camera.position.z) * 0.06;

    if (pointerActive.current) {
      state.raycaster.setFromCamera(pointerNdc.current, state.camera);
      state.raycaster.ray.intersectPlane(pointerPlane, pointer);
    }

    for (let index = 0; index < current.count; index += 1) {
      const offset = index * 3;
      const px = current.positions[offset];
      const py = current.positions[offset + 1];
      const dx = px - pointer.x;
      const dy = py - pointer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let targetX = current.targets[offset];
      let targetY = current.targets[offset + 1];
      let targetZ = current.targets[offset + 2];

      if (distance < repelRadius) {
        const push = (repelRadius - distance) * repelStrength;
        const inverse = 1 / Math.max(distance, 0.0001);
        targetX += (dx * inverse) * push;
        targetY += (dy * inverse) * push;
        targetZ += (hash01(index * 19 + state.clock.elapsedTime * 2.5) - 0.5) * push * 0.06;
      }

      current.positions[offset] += (targetX - current.positions[offset]) * damp;
      current.positions[offset + 1] += (targetY - current.positions[offset + 1]) * damp;
      current.positions[offset + 2] += (targetZ - current.positions[offset + 2]) * damp;
    }

    if (positionAttributeRef.current) {
      positionAttributeRef.current.needsUpdate = true;
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
            uLayerScale: { value: 1.7 },
            uOpacity: { value: 0.28 },
            uSoftness: { value: 1 },
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
            uOpacity: { value: 0.94 },
            uSoftness: { value: 0 },
          }}
        />
      </points>
    </group>
  );
}

export function CountdownScene({
  active,
  reducedMotion,
  quality,
  headerHeightPx,
  countdown,
}: CountdownSceneProps) {
  const pointerTarget = useRef(new Vector3(999, 999, 999));
  const pointerNdc = useRef(new Vector2(0, 0));
  const pointerActive = useRef(false);
  const dprCap = quality === "high" ? 1.5 : quality === "medium" ? 1.25 : 1;
  const safeCountdown = useMemo(
    () => countdown ?? { days: "00", hours: "00", minutes: "00", seconds: "00" },
    [countdown]
  );

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerNdc.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    );
    pointerActive.current = true;
  };

  const handlePointerLeave = () => {
    pointerActive.current = false;
    pointerTarget.current.set(999, 999, 999);
  };

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
      camera={{ position: [0, 0, 7.1], fov: 42 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="h-full w-full"
      style={{ touchAction: "pan-y" }}
    >
      <color attach="background" args={["#030303"]} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[4, 6, 8]} intensity={1.8} color="#f5f5f5" />
      <directionalLight position={[-4, -2, -4]} intensity={0.55} color="#b8b8b8" />
      <AdaptiveDpr pixelated={quality === "low"} />
      <AdaptiveEvents />
      <CountdownParticles
        reducedMotion={reducedMotion}
        quality={quality}
        pointerTarget={pointerTarget}
        pointerNdc={pointerNdc}
        pointerActive={pointerActive}
        headerHeightPx={headerHeightPx}
        countdown={safeCountdown}
      />
    </Canvas>
  );
}
