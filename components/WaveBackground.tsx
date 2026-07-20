"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Mesh, ShaderMaterial } from "three";

type WaveBackgroundProps = {
  active: boolean;
};

const vertexShader = `
varying vec2 vUv;
varying float vHeight;

uniform float uTime;

float wave(vec2 uv) {
  float a = sin(uv.x * 5.0 + uTime * 0.16);
  float b = sin(uv.y * 4.0 - uTime * 0.12);
  float c = sin((uv.x + uv.y) * 3.5 + uTime * 0.1);
  float d = sin(length(uv - 0.5) * 9.0 - uTime * 0.08);
  return a * 0.45 + b * 0.35 + c * 0.2 + d * 0.15;
}

void main() {
  vUv = uv;
  float h = wave(uv);
  vHeight = h;

  vec3 displaced = position;
  displaced.z += h * 0.55;
  displaced.x += sin(uv.y * 6.0 + uTime * 0.08) * 0.08;
  displaced.y += cos(uv.x * 5.5 - uTime * 0.07) * 0.06;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

const fragmentShader = `
varying vec2 vUv;
varying float vHeight;

void main() {
  float rim = 1.0 - smoothstep(0.25, 0.92, distance(vUv, vec2(0.5)));
  float heightGlow = smoothstep(-0.65, 0.65, vHeight);
  float shade = mix(0.06, 0.22, heightGlow);
  vec3 color = vec3(shade);
  float alpha = 0.18 + rim * 0.08;
  gl_FragColor = vec4(color, alpha);
}
`;

function WavePlane() {
  const meshRef = useRef<Mesh>(null!);
  const materialRef = useRef<ShaderMaterial>(null!);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }

    if (meshRef.current) {
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.03) * 0.01;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-0.25, 0, 0]}>
      <planeGeometry args={[12, 7, 180, 120]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        uniforms={{
          uTime: { value: 0 },
        }}
      />
    </mesh>
  );
}

export function WaveBackground({ active }: WaveBackgroundProps) {
  const glConfig = useMemo(
    () => ({
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance" as const,
    }),
    []
  );

  return (
    <Canvas
      frameloop={active ? "always" : "demand"}
      dpr={[1, 1.5]}
      gl={glConfig}
      camera={{ position: [0, 0, 5.5], fov: 42 }}
      className="h-full w-full"
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#030303"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 4, 5]} intensity={0.9} color="#f4f4f4" />
      <directionalLight position={[-3, -2, -4]} intensity={0.3} color="#9a9a9a" />
      <WavePlane />
    </Canvas>
  );
}
