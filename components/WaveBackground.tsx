"use client";

import { useEffect, useRef } from "react";
import { WAVE_EVENT, type RippleDetail } from "@/lib/wave-events";

const DOT_SPACING = 15;
const DOT_RADIUS = 1.85;
const SPRING_K = 0.15;
const DAMPING = 0.5;
const MOUSE_RADIUS = 140;
const MOUSE_FORCE = 1.5;
const WAVE_MAX_RADIUS = 620;
const WAVE_SPEED = 300;
const WAVE_FORCE = 10;
const WAVE_WIDTH = 50;

interface Dot {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxRadius: number;
  forceMul: number;
  speed: number;
  ambient?: boolean;
}

const AMBIENT_MAX_RADIUS = 560;
const AMBIENT_FORCE = 3.5;
const AMBIENT_SPEED = 70;
const AMBIENT_INTERVAL_MIN = 900;
const AMBIENT_INTERVAL_MAX = 1100;

export type AmbientRippleConfig = {
  maxRadius?: number;
  force?: number;
  speed?: number;
  intervalMin?: number;
  intervalMax?: number;
};

function toCanvasCoords(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export default function WaveBackground({
  dotColor = "rgba(255, 255, 255, 0.34)",
  ambient = {},
  active = true,
}: {
  dotColor?: string;
  ambient?: AmbientRippleConfig;
  active?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dots: Dot[] = [];
    const ripples: Ripple[] = [];
    let mouseX = -10000;
    let mouseY = -10000;
    let mouseOnPage = false;
    let animId = 0;
    let canvasWidth = window.innerWidth;
    let canvasHeight = window.innerHeight;

    const getContainerSize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return { width: rect.width, height: rect.height };
        }
      }
      return { width: window.innerWidth, height: window.innerHeight };
    };

    const initDots = () => {
      dots = [];
      const cols = Math.floor(canvasWidth / DOT_SPACING);
      const rows = Math.floor(canvasHeight / DOT_SPACING);
      const offsetX = (canvasWidth - cols * DOT_SPACING) / 2 + DOT_SPACING / 2;
      const offsetY = (canvasHeight - rows * DOT_SPACING) / 2 + DOT_SPACING / 2;

      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const x = offsetX + c * DOT_SPACING;
          const y = offsetY + r * DOT_SPACING;
          dots.push({ baseX: x, baseY: y, x, y, vx: 0, vy: 0 });
        }
      }
    };

    const resize = () => {
      const size = getContainerSize();
      canvasWidth = size.width;
      canvasHeight = size.height;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
      initDots();
    };

    const addRipple = (cx: number, cy: number, maxRadius = WAVE_MAX_RADIUS, forceMul = 1) => {
      const coords = toCanvasCoords(cx, cy, canvas);
      ripples.push({
        x: coords.x,
        y: coords.y,
        radius: 0,
        life: 1,
        maxRadius,
        forceMul,
        speed: WAVE_SPEED,
      });
    };

    const maxRadius = ambient.maxRadius ?? AMBIENT_MAX_RADIUS;
    const forceVal = ambient.force ?? AMBIENT_FORCE;
    const ambientSpeed = ambient.speed ?? AMBIENT_SPEED;
    const intervalMin = ambient.intervalMin ?? AMBIENT_INTERVAL_MIN;
    const intervalMax = ambient.intervalMax ?? AMBIENT_INTERVAL_MAX;

    const spawnAmbientRipple = () => {
      ripples.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 0,
        life: 1,
        maxRadius: maxRadius + Math.random() * (maxRadius * 0.25),
        forceMul: forceVal / WAVE_FORCE,
        speed: ambientSpeed,
        ambient: true,
      });
    };

    const addPerimeterRipples = (r: { top: number; left: number; width: number; height: number }) => {
      const perimeter = 2 * (r.width + r.height);
      const count = Math.max(8, Math.min(24, Math.round(perimeter / 20)));
      const corners: [number, number][] = [
        [r.left, r.top],
        [r.left + r.width, r.top],
        [r.left + r.width, r.top + r.height],
        [r.left, r.top + r.height],
      ];
      const edges: [number, number, number, number][] = [
        [corners[0][0], corners[0][1], corners[1][0], corners[1][1]],
        [corners[1][0], corners[1][1], corners[2][0], corners[2][1]],
        [corners[2][0], corners[2][1], corners[3][0], corners[3][1]],
        [corners[3][0], corners[3][1], corners[0][0], corners[0][1]],
      ];
      const totalLen = edges.reduce(
        (sum, [x1, y1, x2, y2]) => sum + Math.hypot(x2 - x1, y2 - y1),
        0
      );

      for (let i = 0; i < count; i += 1) {
        const targetDist = (i / count) * totalLen;
        let traveled = 0;
        for (const [x1, y1, x2, y2] of edges) {
          const edgeLen = Math.hypot(x2 - x1, y2 - y1);
          if (traveled + edgeLen >= targetDist) {
            const t = (targetDist - traveled) / edgeLen;
            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;
            addRipple(px, py);
            break;
          }
          traveled += edgeLen;
        }
      }
    };

    const update = (dt: number) => {
      const clampedDt = Math.min(dt, 32);
      const factor = clampedDt / 16;

      for (let i = dots.length - 1; i >= 0; i -= 1) {
        const d = dots[i];

        d.vx += (d.baseX - d.x) * SPRING_K;
        d.vy += (d.baseY - d.y) * SPRING_K;

        if (mouseOnPage) {
          const dx = d.x - mouseX;
          const dy = d.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_RADIUS && dist > 0.1) {
            const force = MOUSE_FORCE * (1 - dist / MOUSE_RADIUS) * (1 - dist / MOUSE_RADIUS);
            d.vx += (dx / dist) * force;
            d.vy += (dy / dist) * force;
          }
        }

        for (let r = 0; r < ripples.length; r += 1) {
          const ripple = ripples[r];
          const dx = d.x - ripple.x;
          const dy = d.y - ripple.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const distFromRing = Math.abs(dist - ripple.radius);

          if (distFromRing < WAVE_WIDTH && dist > 0.1) {
            const ringInfluence = 1 - distFromRing / WAVE_WIDTH;
            const force = WAVE_FORCE * ripple.forceMul * ringInfluence * ringInfluence * ripple.life;
            d.vx += (dx / dist) * force;
            d.vy += (dy / dist) * force;
          }
        }

        d.x += d.vx * factor;
        d.y += d.vy * factor;

        d.vx *= DAMPING;
        d.vy *= DAMPING;

        if (Math.abs(d.vx) > 30) d.vx = 30 * Math.sign(d.vx);
        if (Math.abs(d.vy) > 30) d.vy = 30 * Math.sign(d.vy);
      }

      for (let r = ripples.length - 1; r >= 0; r -= 1) {
        const ripple = ripples[r];
        ripple.radius += (ripple.speed * clampedDt) / 1000;
        ripple.life = Math.max(0, 1 - ripple.radius / ripple.maxRadius);
        if (ripple.radius > ripple.maxRadius) {
          ripples.splice(r, 1);
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = "#030303";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = dotColor;
      for (let i = 0; i < dots.length; i += 1) {
        const d = dots[i];
        ctx.beginPath();
        ctx.arc(d.x, d.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    let lastTime = performance.now();
    let ambientTimer: number;

    const loop = (time: number) => {
      if (!active) {
        draw();
        return;
      }

      const dt = time - lastTime;
      lastTime = time;
      update(dt);
      draw();
      animId = requestAnimationFrame(loop);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const coords = toCanvasCoords(e.clientX, e.clientY, canvas);
      mouseX = coords.x;
      mouseY = coords.y;
    };

    const handleMouseEnter = () => {
      mouseOnPage = true;
    };

    const handleMouseLeave = () => {
      mouseOnPage = false;
    };

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button, a, input, textarea, select, [role='button']")) return;
      addRipple(e.clientX, e.clientY);
    };

    const handleCustomRipple = (e: Event) => {
      const detail = (e as CustomEvent<RippleDetail>).detail;
      if (detail.rect) {
        addPerimeterRipples(detail.rect);
      } else {
        addRipple(detail.x, detail.y);
      }
    };

    const scheduleAmbient = () => {
      const delay = intervalMin + Math.random() * (intervalMax - intervalMin);
      ambientTimer = window.setTimeout(() => {
        spawnAmbientRipple();
        scheduleAmbient();
      }, delay);
    };

    scheduleAmbient();
    spawnAmbientRipple();

    resize();
    animId = requestAnimationFrame(loop);

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && canvas.parentElement
        ? new ResizeObserver(() => resize())
        : null;
    resizeObserver?.observe(canvas.parentElement as Element);

    window.addEventListener("resize", resize);
    window.addEventListener(WAVE_EVENT, handleCustomRipple);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("click", handleDocumentClick);

    return () => {
      cancelAnimationFrame(animId);
      window.clearTimeout(ambientTimer);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener(WAVE_EVENT, handleCustomRipple);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [active, ambient.maxRadius, ambient.force, ambient.speed, ambient.intervalMin, ambient.intervalMax, dotColor]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
