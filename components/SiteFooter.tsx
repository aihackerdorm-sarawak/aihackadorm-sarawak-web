"use client";

import { ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/40">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">
              aihackadorm.sarawak
            </p>
            <p className="mt-2 text-sm text-white/65">
              AI Hackadorm 2026 · Sarawak · Built for builders.
            </p>
          </div>

          <a
            href="#hero"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.26em] text-white/70 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            Back to top
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <p className="text-[11px] uppercase tracking-[0.28em] text-white/28">
          © 2026 AI HackerDorm & Swinburne Sarawak
        </p>
      </div>
    </footer>
  );
}

