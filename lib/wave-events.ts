export const WAVE_EVENT = "bg-ripple";

export interface RippleDetail {
  x: number;
  y: number;
  rect?: { top: number; left: number; width: number; height: number };
}

export function triggerBackgroundRipple(detail: RippleDetail) {
  const event = new CustomEvent<RippleDetail>(WAVE_EVENT, { detail });
  window.dispatchEvent(event);
}

export function triggerRippleFromElement(e: React.MouseEvent) {
  e.stopPropagation();
  const target = e.currentTarget as HTMLElement;
  const r = target.getBoundingClientRect();
  triggerBackgroundRipple({
    x: e.clientX,
    y: e.clientY,
    rect: { top: r.top, left: r.left, width: r.width, height: r.height },
  });
}
