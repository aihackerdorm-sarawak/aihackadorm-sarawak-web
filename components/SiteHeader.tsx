"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Menu, Sparkles, X } from "lucide-react";
import { useGraphicsMode } from "./GraphicsMode";
import type { CountdownStage } from "@/lib/countdown";
import Link from "next/link";

type SiteHeaderProps = {
  onNavigate: (id: string) => void;
  stage: CountdownStage;
};

const navItems = [
  { label: "About", id: "about" },
  { label: "Schedule", id: "schedule" },
  { label: "Benefits & Prizes", id: "benefits" },
  { label: "Partner", id: "partner" },
];

function LogoMark() {
  return (
    <span className="relative flex h-10 w-[140px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <Image
        src="/AI-Hackadorm-Nav.jpg"
        alt="AI HackerDorm Sarawak"
        fill
        priority
        sizes="140px"
        className="object-contain p-1.5"
      />
    </span>
  );
}

function getHeaderCta(stage: CountdownStage) {
  if (stage.phase === "registration") {
    return {
      label: "Coming Soon",
      disabled: true,
      href: undefined,
    } as const;
  }

  return {
    label: "Register",
    disabled: false,
    href: "/register",
  } as const;
}

export function SiteHeader({ onNavigate, stage }: SiteHeaderProps) {
  const { graphicsEnabled, toggleGraphics } = useGraphicsMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const cta = getHeaderCta(stage);

  const handleNavigate = (id: string) => {
    setMenuOpen(false);
    onNavigate(id);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#030303]/86 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => handleNavigate("hero")}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <LogoMark />
          <span className="hidden min-w-0 sm:block">
            <span className="block font-mono text-[9px] uppercase tracking-[0.42em] text-white/45">
              Hackathon
            </span>
            <span className="block truncate text-sm font-semibold tracking-[-0.03em] text-white sm:text-base">
              aihackerdorm.sarawak
            </span>
          </span>
        </button>

        <nav className="hidden flex-1 items-center justify-center gap-2 lg:flex">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
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

          {cta.disabled ? (
            <button
              type="button"
              disabled
              title="Coming Soon"
              className="register-cta hidden items-center gap-2 rounded-full border border-white/15 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-75 sm:inline-flex sm:px-4 sm:py-2 sm:text-[11px]"
              data-text={cta.label}
            >
              {cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Link
              href={cta.href}
              className="register-cta hidden items-center gap-2 rounded-full border border-white/15 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-black transition-opacity sm:inline-flex sm:px-4 sm:py-2 sm:text-[11px]"
              data-text={cta.label}
            >
              {cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Navigation menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition-colors hover:border-white/25 hover:bg-white/10 lg:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav id="mobile-nav" className="border-t border-white/10 bg-[#030303]/95 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-4 sm:px-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-[11px] uppercase tracking-[0.26em] text-white/75 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </button>
            ))}
            {cta.disabled ? (
              <button
                type="button"
                disabled
                title="Coming Soon"
                className="register-cta mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-black disabled:cursor-not-allowed disabled:opacity-75"
                data-text={cta.label}
              >
                {cta.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <Link
                href={cta.href}
                className="register-cta mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-black"
                data-text={cta.label}
              >
                {cta.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
