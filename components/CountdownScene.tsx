"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  sceneWidth: number;
  sceneHeight: number;
  sceneOffsetY: number;
  pointSizeMin: number;
  pointSizeMax: number;
  pointScale: number;
  jitter: number;
  sampleStride: number;
  maxParticles: number;
};

type ParticleSystem = {
  positions: Float32Array;
  basePositions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  count: number;
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
  displaced.z += sin(uTime * 0.7 + position.x * 1.12 + position.y * 0.88) * 0.012;
  displaced.x += sin(uTime * 0.28 + position.y * 1.04) * 0.0028;
  displaced.y += cos(uTime * 0.24 + position.x * 0.96) * 0.0022;

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
  float alpha = mix(core, core * 0.65 + glow * 0.35, uSoftness);

  gl_FragColor = vec4(vColor, alpha * uOpacity);
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

function getSettings(quality: QualityTier, stacked: boolean, viewportWidth: number): CountdownSettings {
  const viewportScale = viewportWidth >= 1440 ? 1.08 : viewportWidth >= 1024 ? 1.03 : 1;

  if (quality === "high") {
    return {
      canvasWidth: stacked ? 820 : 1280,
      canvasHeight: stacked ? 920 : 320,
      fontSize: stacked ? 128 : 138,
      sceneWidth: stacked ? 4.75 : 5.15,
      sceneHeight: stacked ? 4.9 : 1.72,
      sceneOffsetY: stacked ? -0.16 : -0.04,
      pointSizeMin: 0.03 * viewportScale,
      pointSizeMax: 0.062 * viewportScale,
      pointScale: 4.0 * viewportScale,
      jitter: stacked ? 0.05 : 0.07,
      sampleStride: stacked ? 4 : 4,
      maxParticles: stacked ? 7000 : 9000,
    };
  }

  if (quality === "low") {
    return {
      canvasWidth: stacked ? 760 : 1120,
      canvasHeight: stacked ? 860 : 280,
      fontSize: stacked ? 112 : 122,
      sceneWidth: stacked ? 4.5 : 5.0,
      sceneHeight: stacked ? 4.55 : 1.62,
      sceneOffsetY: stacked ? -0.15 : -0.035,
      pointSizeMin: 0.024 * viewportScale,
      pointSizeMax: 0.05 * viewportScale,
      pointScale: 3.1 * viewportScale,
      jitter: stacked ? 0.04 : 0.06,
      sampleStride: stacked ? 5 : 5,
      maxParticles: stacked ? 5200 : 7200,
    };
  }

  return {
    canvasWidth: stacked ? 790 : 1200,
    canvasHeight: stacked ? 900 : 300,
    fontSize: stacked ? 120 : 130,
    sceneWidth: stacked ? 4.6 : 5.05,
    sceneHeight: stacked ? 4.7 : 1.68,
    sceneOffsetY: stacked ? -0.155 : -0.038,
    pointSizeMin: 0.027 * viewportScale,
    pointSizeMax: 0.056 * viewportScale,
    pointScale: 3.45 * viewportScale,
    jitter: stacked ? 0.045 : 0.065,
    sampleStride: stacked ? 4 : 4,
    maxParticles: stacked ? 6200 : 8000,
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

function drawCountdownCanvas(
  countdown: CountdownValue,
  stacked: boolean,
  settings: CountdownSettings
) {
  const canvas = document.createElement("canvas");
  canvas.width = settings.canvasWidth;
  canvas.height = settings.canvasHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return [] as SamplePoint[];
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${settings.fontSize}px "Arial Black", "Segoe UI Black", system-ui, sans-serif`;

  if (stacked) {
    const rows = [countdown.days, countdown.hours, countdown.minutes, countdown.seconds];
    const centers = [0.18, 0.41, 0.64, 0.87];

    rows.forEach((row, index) => {
      ctx.fillText(row, canvas.width / 2, canvas.height * centers[index]);
    });
  } else {
    ctx.fillText(
      `${countdown.days} : ${countdown.hours} : ${countdown.minutes} : ${countdown.seconds}`,
      canvas.width / 2,
      canvas.height / 2
    );
  }

  const stride = settings.sampleStride;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const points: SamplePoint[] = [];

  for (let y = 0; y < canvas.height; y += stride) {
    for (let x = 0; x < canvas.width; x += stride) {
      const index = (y * canvas.width + x) * 4;
      const alpha = image[index + 3];

      if (alpha > 12) {
        points.push({ x, y, alpha });
      }
    }
  }

  return reduceSamplePoints(points, settings.maxParticles);
}

function createParticleSystem(
  points: SamplePoint[],
  settings: CountdownSettings
): ParticleSystem {
  const count = Math.max(points.length, 1);
  const positions = new Float32Array(count * 3);
  const basePositions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const width = settings.canvasWidth;
  const height = settings.canvasHeight;

  for (let index = 0; index < count; index += 1) {
    const point = points[index] ?? {
      x: width / 2,
      y: height / 2,
      alpha: 255,
    };
    const seed = index * 997 + point.x * 31 + point.y * 17;
    const normalizedX = point.x / width;
    const normalizedY = point.y / height;
    const alpha = point.alpha / 255;
    const density = Math.min(1, Math.max(0, alpha));
    const centerWeight = 1 - Math.min(1, Math.abs(normalizedX - 0.5) * 1.5 + Math.abs(normalizedY - 0.5) * 0.8);

    const baseX = (normalizedX - 0.5) * settings.sceneWidth;
    const baseY = (0.5 - normalizedY) * settings.sceneHeight + settings.sceneOffsetY;
    const baseZ = (hash01(seed + 19) - 0.5) * 0.06;

    const jitterX = (hash01(seed) - 0.5) * settings.jitter;
    const jitterY = (hash01(seed + 7) - 0.5) * settings.jitter;
    const jitterZ = (hash01(seed + 13) - 0.5) * 0.04;

    const offset = index * 3;
    basePositions[offset] = baseX;
    basePositions[offset + 1] = baseY;
    basePositions[offset + 2] = baseZ;

    positions[offset] = baseX + jitterX;
    positions[offset + 1] = baseY + jitterY;
    positions[offset + 2] = baseZ + jitterZ;

    const toneRoll = hash01(seed + 23);
    const tone =
      density > 0.72 || centerWeight > 0.55
        ? PALETTE[0]
        : toneRoll > 0.55
          ? PALETTE[1]
          : PALETTE[2];
    const rgb = {
      r: Number.parseInt(tone.slice(1, 3), 16),
      g: Number.parseInt(tone.slice(3, 5), 16),
      b: Number.parseInt(tone.slice(5, 7), 16),
    };

    colors[offset] = rgb.r / 255;
    colors[offset + 1] = rgb.g / 255;
    colors[offset + 2] = rgb.b / 255;
    sizes[index] =
      settings.pointSizeMin +
      density * (settings.pointSizeMax - settings.pointSizeMin) +
      (hash01(seed + 41) - 0.5) * 0.0035;
  }

  return {
    positions,
    basePositions,
    colors,
    sizes,
    count,
  };
}

function CountdownParticles({
  reducedMotion,
  quality,
  headerHeightPx,
  countdown,
}: {
  reducedMotion: boolean;
  quality: QualityTier;
  headerHeightPx: number;
  countdown: CountdownValue;
}) {
  const [geometry] = useState(() => new BufferGeometry());
  const positionAttributeRef = useRef<BufferAttribute | null>(null);
  const glowMaterialRef = useRef<ShaderMaterial>(null!);
  const coreMaterialRef = useRef<ShaderMaterial>(null!);
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
    () => getSettings(quality, stacked, viewportWidth),
    [quality, stacked, viewportWidth]
  );
  const sceneOffsetY = useMemo(() => {
    const headerWorldHeight = pixelsToWorldUnits(
      headerHeightPx,
      viewportHeight,
      cameraViewportHeight
    );
    return settings.sceneOffsetY - headerWorldHeight * 0.08;
  }, [cameraViewportHeight, headerHeightPx, settings.sceneOffsetY, viewportHeight]);
  const sampledPoints = useMemo(
    () => drawCountdownCanvas(countdown, stacked, settings),
    [countdown, settings, stacked]
  );
  const system = useMemo(
    () => createParticleSystem(sampledPoints, { ...settings, sceneOffsetY }),
    [sampledPoints, sceneOffsetY, settings]
  );
  const systemRef = useRef(system);
  const pointerWorld = useRef(new Vector3(0, 0, 0));

  useEffect(() => {
    systemRef.current = system;
    geometry.setAttribute("position", new BufferAttribute(system.positions, 3));
    geometry.setAttribute("aColor", new BufferAttribute(system.colors, 3));
    geometry.setAttribute("aSize", new BufferAttribute(system.sizes, 1));
    positionAttributeRef.current = geometry.getAttribute("position") as BufferAttribute;
    geometry.computeBoundingSphere();
  }, [geometry, system]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame((state) => {
    const current = systemRef.current;
    const pointer = pointerWorld.current;
    const repelRadius = reducedMotion ? 0.2 : 0.32;
    const repelStrength = reducedMotion ? 0.09 : 0.16;
    const settle = reducedMotion ? 0.08 : 0.14;

    if (glowMaterialRef.current) {
      glowMaterialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      glowMaterialRef.current.uniforms.uPointScale.value = settings.pointScale;
    }

    if (coreMaterialRef.current) {
      coreMaterialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      coreMaterialRef.current.uniforms.uPointScale.value = settings.pointScale;
    }

    state.camera.position.z = MathUtils.lerp(state.camera.position.z, cameraZ, 0.06);

    for (let index = 0; index < current.count; index += 1) {
      const offset = index * 3;
      const baseX = current.basePositions[offset];
      const baseY = current.basePositions[offset + 1];
      const baseZ = current.basePositions[offset + 2];

      let desiredX = baseX;
      let desiredY = baseY;
      let desiredZ = baseZ;

      if (pointerActive.current) {
        const dx = baseX - pointer.x;
        const dy = baseY - pointer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < repelRadius) {
          const influence = 1 - distance / repelRadius;
          const inverse = 1 / Math.max(distance, 0.0001);
          desiredX += dx * inverse * influence * repelStrength;
          desiredY += dy * inverse * influence * repelStrength;
          desiredZ +=
            (hash01(index * 19 + state.clock.elapsedTime * 2.5) - 0.5) * influence * 0.05;
        }
      }

      current.positions[offset] = MathUtils.lerp(current.positions[offset], desiredX, settle);
      current.positions[offset + 1] = MathUtils.lerp(
        current.positions[offset + 1],
        desiredY,
        settle
      );
      current.positions[offset + 2] = MathUtils.lerp(
        current.positions[offset + 2],
        desiredZ,
        settle
      );
    }

    if (positionAttributeRef.current) {
      positionAttributeRef.current.needsUpdate = true;
    }
  });

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    pointerWorld.current.copy(event.point);
    pointerActive.current = true;
  };

  const handlePointerLeave = () => {
    pointerActive.current = false;
    pointerWorld.current.set(999, 999, 999);
  };

  return (
    <group>
      <mesh
        position={[0, 0, -0.45]}
        scale={[8.2, 5.8, 1]}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

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
            uLayerScale: { value: 1.55 },
            uOpacity: { value: 0.3 },
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
            uOpacity: { value: 0.96 },
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
      <CountdownParticles
        reducedMotion={reducedMotion}
        quality={quality}
        headerHeightPx={headerHeightPx}
        countdown={safeCountdown}
      />
    </Canvas>
  );
}
