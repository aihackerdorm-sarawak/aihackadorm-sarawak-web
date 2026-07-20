"use client";

import { ChevronDown, Menu, Sparkles } from "lucide-react";
import { useGraphicsMode } from "./GraphicsMode";

type SiteHeaderProps = {
  onNavigate: (id: string) => void;
};

const navItems = [
  { label: "About", id: "about" },
  { label: "Schedule", id: "schedule" },
  { label: "Benefits & Prizes", id: "benefits" },
  { label: "Partner", id: "partner" },
];

function LogoMark() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[10px] font-black tracking-[0.18em] text-white">
      AI
    </span>
  );
}

export function SiteHeader({ onNavigate }: SiteHeaderProps) {
  const { graphicsEnabled, toggleGraphics } = useGraphicsMode();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#030303]/86 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => onNavigate("hero")}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <LogoMark />
          <span className="min-w-0">
            <span className="block font-mono text-[9px] uppercase tracking-[0.42em] text-white/45">
              Hackathon
            </span>
            <span className="block truncate text-sm font-semibold tracking-[-0.03em] text-white sm:text-base">
              aihackadorm.sarawak
            </span>
          </span>
        </button>

        <nav className="hidden flex-1 items-center justify-center gap-2 lg:flex">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-white/70 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleGraphics}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.26em] text-white/70 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white sm:px-4"
            aria-label={`Graphics ${graphicsEnabled ? "enabled" : "disabled"}`}
            title={`Graphics ${graphicsEnabled ? "On" : "Off"}`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Graphics:</span>
            <span>{graphicsEnabled ? "On" : "Off"}</span>
          </button>

          <button
            type="button"
            disabled
            title="Coming Soon"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white text-[10px] font-semibold uppercase tracking-[0.26em] text-black opacity-85 transition-opacity disabled:cursor-not-allowed disabled:hover:opacity-85 sm:px-4 sm:py-2 sm:text-[11px]"
          >
            <span>Coming Soon</span>
            <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
          </button>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition-colors hover:border-white/25 hover:bg-white/10 lg:hidden"
            aria-label="Navigation menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
