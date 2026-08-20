"use client";

import { Component, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail,
  Sparkles,
  Trophy,
} from "lucide-react";
import { GraphicsModeProvider, useGraphicsMode } from "./GraphicsMode";
import { SectionReveal } from "./SectionReveal";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { CountdownScene } from "./CountdownScene";
import WaveBackground from "./WaveBackground";
import { formatCountdownParts, getCountdownStage, padTwo, type CountdownStage } from "@/lib/countdown";
import { getDeviceQuality, type QualityTier } from "@/lib/device-quality";
import { FaqAccordion } from "./Faq";
import RegistrationForm from './RegistrationForm';

type ScheduleItem = {
  id: string;
  label: string;
  date: string;
  hint: string;
  title: string;
  copy: string;
  badge?: string;
  status?: string;
  /** Where the milestone's register CTA points. Placeholder until the
      workshop registration pages are live. */
  registerHref?: string;
};

type CountdownValues = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

const scheduleItems: ScheduleItem[] = [
  {
    id: "registration",
    label: "Registration Opens",
    date: "Sep 1, 2026",
    hint: "Launch milestone",
    title: "Registration opens",
    copy:
      "The first live milestone. This is when the page switches from launch countdown into registration countdown mode.",
    status: "Live soon",
  },
  {
    id: "workshop",
    label: "Pre-Hackathon Workshop 1",
    date: "Sep 10, 2026",
    hint: "Warm-up session",
    title: "Pre-hackathon workshop 1",
    copy:
      "A tentative warm-up session to help teams prepare, meet mentors, and calibrate ideas before the main build window.",
    badge: "Tentative",
    // Placeholder — point to the live workshop registration page when it exists.
    registerHref: "/register?form=workshop",
  },
  {
    id: "workshop-2",
    label: "Pre-Hackathon Workshop 2",
    date: "Oct 5, 2026",
    hint: "Deep dive session",
    title: "Pre-hackathon workshop 2",
    copy:
      "A second warm-up session to go deeper on the tools and techniques teams will use during the main build window.",
    badge: "Tentative",
    // Placeholder — point to the live workshop registration page when it exists.
    registerHref: "/register?form=workshop",
  },
  {
    id: "main-event",
    label: "Main Event",
    date: "Oct 9, 2026",
    hint: "Build begins",
    title: "Main event begins",
    copy:
      "The main hackathon start date. The countdown then shifts into the 3-day live event window until completion.",
    status: "3-day event",
  },
];

// Id of the first workshop milestone — the hero "Workshops" button focuses
// this point on the timeline when clicked.
const FIRST_WORKSHOP_ID =
  scheduleItems.find((item) => item.id.startsWith("workshop"))?.id ?? "workshop";

const benefitCards = ["To Be Announced", "To Be Announced", "To Be Announced"];

const partnerLinks = [
  { label: "Instagram", handle: "@aihackerdorm.sarawak", href: "https://www.instagram.com/aihackerdorm.sarawak/" },
  {
    label: "LinkedIn",
    handle: "Borneo Hackathon",
    href: "https://www.linkedin.com/in/borneo-hackathon-6b80bb421/",
  },
  { label: "Email", handle: "team@aihackerdorm.com", href: "mailto:team@aihackerdorm.com" },
];

function useScrollToId() {
  const reducedMotion = useReducedMotion() ?? true;

  return (id: string) => {
    const target = document.getElementById(id);
    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };
}

function useCountdownState() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  const stage = getCountdownStage(now);
  const parts = formatCountdownParts(stage.target, now);
  const values = {
    days: padTwo(parts.days),
    hours: padTwo(parts.hours),
    minutes: padTwo(parts.minutes),
    seconds: padTwo(parts.seconds),
  };

  return {
    stage,
    parts,
    values,
  };
}

function useSectionObserver<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsInView(entry.isIntersecting);
        }
      },
      // threshold is a fraction of the observed element's OWN height, not the
      // viewport — fine for a section roughly one viewport tall (Hero), but
      // WaveZone wraps six stacked subsections (~2800px), so 8% of that is
      // ~225px and the wave stayed frozen at active=false until deep into a
      // scroll. threshold: 0 fires on any intersection regardless of the
      // target's size; rootMargin pre-activates just before it's on screen
      // so there's no visible pop-in.
      {
        threshold: 0,
        rootMargin: "200px 0px",
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, isInView };
}

function SectionShell({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-md sm:p-7">
      <div className="max-w-3xl space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.42em] text-cyan-400/60">{eyebrow}</p>
        <h2 className="text-3xl font-black uppercase tracking-[-0.06em] text-white sm:text-5xl">
          {title}
        </h2>
        {copy ? <p className="max-w-2xl text-sm leading-7 text-white/55 sm:text-base">{copy}</p> : null}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function PrimaryButton({
  children,
  disabled = false,
  href,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "register-cta inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-75";

  if (href && !disabled) {
    return (
      <a href={href} className={className} data-text={typeof children === "string" ? children : undefined}>
        {children}
        <ArrowRight className="h-3.5 w-3.5" />
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "Coming Soon" : undefined}
      className={className}
      data-text={typeof children === "string" ? children : undefined}
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}

function getRegistrationCta(stage: CountdownStage) {
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

function RegistrationCta({ stage }: { stage: CountdownStage }) {
  // We brought this line back so the timer controls the button again!
  const cta = getRegistrationCta(stage);

  return (
    <PrimaryButton disabled={cta.disabled} href={cta.href}>
      {cta.label}
    </PrimaryButton>
  );
}


function CountdownLabels() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 px-4 sm:top-5 sm:px-6">
      <div className="grid gap-4 text-center md:grid-cols-4">
        {[
          ["days", "Day"],
          ["hours", "Hour"],
          ["minutes", "Min"],
          ["seconds", "Sec"],
        ].map(([key, label]) => (
          <div key={key} className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.42em] text-white/42">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CountdownWebGLFrame({
  active,
  reducedMotion,
  quality,
  headerHeightPx,
  values,
}: {
  active: boolean;
  reducedMotion: boolean;
  quality: "low" | "medium" | "high";
  headerHeightPx: number;
  values: CountdownValues;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [containerWidthPx, setContainerWidthPx] = useState(0);
  const [containerHeightPx, setContainerHeightPx] = useState(0);

  useEffect(() => {
    const element = frameRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const commit = (width: number, height: number) => {
      setContainerWidthPx(width);
      setContainerHeightPx(height);
    };

    // Debounce: the container size drives sceneWidth/Height, which are part of
    // the digit-group structural key, so committing every intermediate resize
    // size re-samples all the digit/label text (8 offscreen canvases +
    // getImageData) per frame during a drag. Commit only once it settles; the
    // initial size below is applied immediately so first paint is correct.
    let timer: number;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => commit(width, height), 150);
    });

    const rect = element.getBoundingClientRect();
    commit(rect.width, rect.height);
    observer.observe(element);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={frameRef}
      className="relative h-[560px] md:h-[300px] w-full overflow-hidden rounded-[30px] bg-black/40"
    >
      {/* <CountdownLabels /> */}
      <CountdownScene
        active={active}
        reducedMotion={reducedMotion}
        quality={quality}
        headerHeightPx={headerHeightPx}
        containerWidthPx={containerWidthPx}
        containerHeightPx={containerHeightPx}
        countdown={values}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_42%)]" />
    </div>
  );
}

class CountdownWebGLErrorBoundary extends Component<
  {
    values: CountdownValues;
    stageLabel: string;
    completed: boolean;
    message?: string;
    children: ReactNode;
  },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <CountdownFallback
          values={this.props.values}
          stageLabel={this.props.stageLabel}
          completed={this.props.completed}
          message={this.props.message}
        />
      );
    }

    return this.props.children;
  }
}

function CountdownFallback({
  values,
  stageLabel,
  completed,
  message,
}: {
  values: CountdownValues;
  stageLabel: string;
  completed: boolean;
  message?: string;
}) {
  if (completed) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-[30px] border border-white/10 bg-black/35 px-6 py-10 text-center">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/35">
            {stageLabel}
          </p>
          <h3 className="mt-4 text-3xl font-black uppercase tracking-[-0.06em] text-white sm:text-5xl">
            AI HackerDorm 2026 - Completed
          </h3>
          {message ? <p className="mt-4 text-sm text-white/55">{message}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-[30px] border border-white/10 bg-black/35 p-5 text-center sm:grid-cols-4 sm:gap-5 sm:p-7">
      {[
        ["days", "Day"],
        ["hours", "Hour"],
        ["minutes", "Min"],
        ["seconds", "Sec"],
      ].map(([key, label]) => (
        <div key={key} className="rounded-[24px] border border-white/10 bg-white/[0.035] px-4 py-5">
          <div className="text-[clamp(2.1rem,8vw,4rem)] font-black leading-none tracking-[-0.08em] text-white">
            {values[key as keyof typeof values]}
          </div>
          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.38em] text-white/35">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

// Stable no-op subscribe for the client-mount check below (useSyncExternalStore
// requires a referentially stable subscribe).
const subscribeNoop = () => () => {};

function CountdownSection({ stage, values }: { stage: CountdownStage; values: CountdownValues }) {
  const reducedMotion = useReducedMotion() ?? true;
  const { graphicsEnabled } = useGraphicsMode();
  const { ref, isInView } = useSectionObserver<HTMLDivElement>();
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeightPx, setHeaderHeightPx] = useState(0);

  // Client-only mount gate for the WebGL countdown. Was previously an
  // isMounted flag flipped inside requestAnimationFrame — but rAF is
  // throttled/paused in a background or unfocused tab, so the countdown stayed
  // absent until the tab was focused. useSyncExternalStore returns false on
  // the server + during hydration and true once mounted, hydration-safe and
  // NOT tied to frame timing. Quality is device-based and never changes, so a
  // lazy useState initializer computes it once (returns "medium" on the
  // server, where getDeviceQuality can't touch navigator/matchMedia).
  const isMounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const [quality] = useState<QualityTier>(() =>
    typeof window === "undefined" ? "medium" : getDeviceQuality()
  );

  useEffect(() => {
    const element = headerRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setHeaderHeightPx(entry.contentRect.height);
      }
    });

    setHeaderHeightPx(element.getBoundingClientRect().height);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <section
      ref={ref}
      id="countdown"
      className="relative overflow-hidden border-b border-white/10 px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-10 lg:px-8"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div ref={headerRef} className="max-w-4xl space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.42em] text-cyan-400/60">
            Countdown
          </p>
          <h2 className="text-4xl font-black uppercase tracking-[-0.08em] text-white sm:text-6xl lg:text-7xl">
            {stage.completed ? "The event has finished." : `Counting down to ${stage.label}.`}
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-white/55 sm:text-base">
            {stage.eyebrow}.{" "}
            {stage.phase === "event-live"
              ? "The main event is live — 3 days on the clock until it wraps up."
              : "This page updates automatically as each milestone — registration, the workshop, and the main event — arrives."}
          </p>
        </div>

        {graphicsEnabled && !stage.completed ? (
          <CountdownWebGLErrorBoundary
            values={values}
            stageLabel={stage.eyebrow}
            completed={stage.completed}
            message={stage.message}
          >
            <CountdownWebGLFrame
              active={isInView}
              reducedMotion={reducedMotion}
              quality={quality}
              headerHeightPx={headerHeightPx}
              values={values}
            />
          </CountdownWebGLErrorBoundary>
        ) : (
          <CountdownFallback
            values={values}
            stageLabel={stage.eyebrow}
            completed={stage.completed}
            message={stage.message}
          />
        )}

        {!stage.completed ? (
          <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.36em] text-white/32">
            <span>{stage.label}</span>
            <span>-</span>
            <span>
              {values.days}:{values.hours}:{values.minutes}:{values.seconds}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function HeroSection({
  stage,
  onWorkshopsClick,
}: {
  stage: CountdownStage;
  onWorkshopsClick: () => void;
}) {
  const reducedMotion = useReducedMotion() ?? true;
  const { graphicsEnabled } = useGraphicsMode();
  const { ref, isInView } = useSectionObserver<HTMLElement>();

  return (
    <section
      ref={ref}
      id="hero"
      className="relative isolate overflow-hidden px-4 pb-14 pt-10 sm:px-6 sm:pb-16 lg:px-8"
    >
      {graphicsEnabled ? (
        <div className="pointer-events-none absolute inset-0 z-0">
          <WaveBackground active={isInView} />
          {/* Lighter overlay so the hero wave reads as bright as the lower
              WaveZone wave. The hero is only ~one viewport tall, so an overlay
              matching WaveZone's darker END would over-dim it — keep it light
              and roughly flat, with a mild bottom fade for the paragraph/
              buttons and to blend into the countdown section below. */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(3,3,3,0.15),rgba(3,3,3,0.45))]" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 z-0 bg-[#030303]" />
      )}

      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
        <div className="max-w-3xl space-y-6">
          <motion.p
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.48em] text-white/65"
          >
            Oct 9-11, 2026 - Kuching, Sarawak - 3 days
          </motion.p>

          <motion.h1
            initial={reducedMotion ? false : { opacity: 0, y: 14, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl text-[clamp(3.2rem,11vw,7.8rem)] font-black uppercase leading-[0.86] tracking-[-0.08em] text-white"
          >
            <span className="block">Build the</span>
            <span
              className="block text-cyan-300/70"
              style={{ textShadow: "-0.045em 0 rgba(0,255,255,0.65), 0.045em 0 rgba(0,140,255,0.55)" }}
            >
              future
            </span>
            <span className="block">with AI.</span>
          </motion.h1>

          <motion.p
            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="max-w-2xl text-sm leading-7 text-white/55 sm:text-base"
          >
            AI Hackerdorm Sarawak is a 3-day hackathon by AI HackerDorm and the Swinburne
            Computer Science Club. Students and developers build real AI solutions under one roof
            in Kuching, Borneo.
          </motion.p>

          <div className="flex flex-wrap items-center gap-3">
            <RegistrationCta stage={stage} />
            <button
              type="button"
              onClick={onWorkshopsClick}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              Workshops
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-[30rem]">
          {[
            { label: "Hackathon", value: "3 days" },
            { label: "Format", value: "Build + mentor" },
            { label: "Location", value: "Kuching" },
            { label: "Focus", value: "AI solutions" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.36em] text-cyan-400/60">
                {item.label}
              </p>
              <p className="mt-4 text-2xl font-black uppercase tracking-[-0.05em] text-white">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SponsorsSection() {
  return (
    <SectionReveal id="sponsors" className="scroll-mt-28" delay={0.04}>
      <SectionShell
        eyebrow="Sponsors"
        title="Partners coming soon."
        copy="Sponsor partners will be announced as they're confirmed — check back closer to the event."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {["Logo TBC", "Logo TBC"].map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="flex min-h-28 items-center justify-center rounded-[24px] border border-white/10 bg-black/30 text-sm uppercase tracking-[0.28em] text-white/28"
            >
              {label}
            </div>
          ))}
        </div>
      </SectionShell>
    </SectionReveal>
  );
}

function ScheduleSection({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selectedIndex = Math.max(
    0,
    scheduleItems.findIndex((item) => item.id === selectedId)
  );
  const selected = scheduleItems[selectedIndex] ?? scheduleItems[0];
  const milestoneRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  const goToIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(scheduleItems.length - 1, index));
    onSelect(scheduleItems[clamped].id);
  };

  const atStart = selectedIndex === 0;
  const atEnd = selectedIndex === scheduleItems.length - 1;

  // The timeline row scrolls horizontally on narrow/mobile viewports (it's
  // wider than the screen there). Tapping a milestone directly is always
  // visible already, but the prev/next arrow buttons on the timeline can move
  // the active dot off-screen — scroll it back into view (centered) whichever
  // way selection changed, so the highlighted point is never hidden. Scrolled
  // manually via scrollTo (horizontal only), NOT scrollIntoView: that method
  // walks up to find a scrollable ancestor per axis, and since nothing here
  // has vertical overflow, its `block` option falls back to the page itself —
  // which visibly jumped the whole page's scroll position on mount.
  useEffect(() => {
    const container = timelineScrollRef.current;
    const button = milestoneRefs.current[selectedIndex];
    if (!container || !button) {
      return;
    }
    const target = button.offsetLeft + button.offsetWidth / 2 - container.clientWidth / 2;
    container.scrollTo({ left: target, behavior: "smooth" });
  }, [selectedIndex]);

  return (
    <SectionReveal id="schedule" className="scroll-mt-28" delay={0.06}>
      <SectionShell
        eyebrow="Schedule"
        title="Key dates."
        copy="Tap a milestone above, or use the arrows, to see its details below."
      >
        <div className="space-y-6">
          {/* The connecting line sits 32px above this row's bottom (scroller
              pb-4 + line bottom-4). The arrows are items-end aligned, so each
              gets a bottom margin that lifts its midpoint onto that line:
              h-8  → 32 − 16 = 16px (mb-4); h-12 → 32 − 24 = 8px (mb-2).
              If the button sizes change, update these margins to match. */}
          <div className="flex items-end gap-1 min-[391px]:gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => goToIndex(selectedIndex - 1)}
              disabled={atStart}
              aria-label="Previous milestone"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-white/10 disabled:hover:bg-white/5 disabled:hover:text-white/70 min-[391px]:h-12 min-[391px]:w-12 mb-4 min-[391px]:mb-2"
            >
              <ChevronLeft className="h-4 w-4 min-[391px]:h-5 min-[391px]:w-5" />
            </button>

            <div ref={timelineScrollRef} className="min-w-0 flex-1 overflow-x-auto pb-4">
              <div className="relative min-w-[800px] px-3 pt-2">
                {/* Connecting line sits on the dot row at the bottom, clear of the text above. */}
                <div className="pointer-events-none absolute inset-x-3 bottom-4 h-px bg-white/15" />
                <div className="grid grid-cols-4 gap-4">
                  {scheduleItems.map((item, index) => {
                    const active = item.id === selectedId;

                    return (
                      <button
                        key={item.id}
                        ref={(el) => {
                          milestoneRefs.current[index] = el;
                        }}
                        type="button"
                        onClick={() => onSelect(item.id)}
                        aria-pressed={active}
                        className="relative flex min-h-32 flex-col items-center gap-3 text-center"
                      >
                        <div className="flex flex-col items-center gap-2 px-3">
                          <p className="font-mono text-[10px] uppercase tracking-[0.36em] text-white/45">
                            {item.hint}
                          </p>
                          <h3
                            className={`text-[11px] font-semibold uppercase tracking-[0.24em] transition-colors ${
                              active ? "text-white" : "text-white/60"
                            }`}
                          >
                            {item.label}
                          </h3>
                          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/32">
                            {item.date}
                          </p>
                        </div>

                        <span className="mt-auto flex h-8 items-center justify-center">
                          <span
                            className={`relative z-10 block h-4 w-4 rounded-full border transition-all ${
                              active
                                ? "border-white bg-white shadow-[0_0_0_6px_rgba(255,255,255,0.08)]"
                                : "border-white/45 bg-[#030303]"
                            }`}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => goToIndex(selectedIndex + 1)}
              disabled={atEnd}
              aria-label="Next milestone"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-white/10 disabled:hover:bg-white/5 disabled:hover:text-white/70 min-[391px]:h-12 min-[391px]:w-12 mb-4 min-[391px]:mb-2"
            >
              <ChevronRight className="h-4 w-4 min-[391px]:h-5 min-[391px]:w-5" />
            </button>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/30 p-4 sm:p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.36em] text-white/35">
              Shared detail card
            </p>
            <h3 className="mt-2 max-w-full break-words text-xl font-black uppercase leading-tight tracking-[-0.05em] text-white sm:text-2xl">
              {selected.title}
            </h3>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.28em] text-white/35">
              {selectedIndex + 1} / {scheduleItems.length}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/55">{selected.copy}</p>
            {selected.registerHref ? (
              <a
                href={selected.registerHref}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-black transition-colors hover:bg-cyan-400"
              >
                Register for this workshop
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-white/32">
              <span>{selected.date}</span>
              <span>-</span>
              {selected.badge ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[9px] uppercase tracking-[0.28em] text-white/45">
                  {selected.badge}
                </span>
              ) : selected.status ? (
                <span>{selected.status}</span>
              ) : null}
            </div>
          </div>
        </div>
      </SectionShell>
    </SectionReveal>
  );
}

function BenefitsSection() {
  return (
    <SectionReveal id="benefits" className="scroll-mt-28" delay={0.08}>
      <SectionShell
        eyebrow="Benefits & Prizes"
        title="What you win."
        copy="Prize details will be announced closer to the event — stay tuned."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {benefitCards.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="rounded-[24px] border border-white/10 bg-black/30 p-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/65">
                  <Trophy className="h-4 w-4" />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.36em] text-white/35">
                  Prize
                </p>
              </div>
              <p className="mt-5 text-lg font-black uppercase tracking-[-0.04em] text-white">
                {label}
              </p>
              <p className="mt-2 text-sm leading-7 text-white/48">
                Details will be revealed closer to the event.
              </p>
            </div>
          ))}
        </div>
      </SectionShell>
    </SectionReveal>
  );
}

function FaqSection() {
  return (
    <SectionReveal id="faq" className="scroll-mt-28" delay={0.09}>
      <SectionShell
        eyebrow="FAQ"
        title="Got questions?"
        copy="Here's what people usually ask before signing up."
      >
        <FaqAccordion />
      </SectionShell>
    </SectionReveal>
  );
}

function CollaboratorsSection() {
  return (
    <SectionReveal id="collaborators" className="scroll-mt-28" delay={0.1}>
      <SectionShell
        eyebrow="Collaborators"
        title="AI HackerDorm x Swinburne Computer Science Club"
        copy="Two student communities, one shared build room."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              name: "AI HackerDorm",
              logos: [{ src: "/AI-Hackadorm.png", alt: "AI HackerDorm logo" }],
              copy: "Student-led community focused on building AI capability, momentum, and useful collaboration across the region.",
              url: "https://www.aihackerdorm.com/",
            },
            {
              name: "Swinburne Computer Science Club",
              logos: [
                {
                  src: "/computersci-logo.png",
                  alt: "Swinburne Computer Science Club logo",
                },
                {
                  src: "/Swinburne-Logo.jpg",
                  alt: "Swinburne University of Technology Sarawak Campus logo",
                },
              ],
              copy: "A student-led computing community at Swinburne Sarawak, connecting students with practical technology, collaboration, and industry opportunities.",
              url: "https://www.instagram.com/swinburnecompsci/",
            },
          ].map((item) => (
            <a
              key={item.name}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block rounded-[24px] border border-white/10 bg-black/30 p-5 transition-colors hover:border-white/25 hover:bg-black/40"
            >
              <ExternalLink className="absolute right-5 top-5 h-4 w-4 text-white/30 transition-colors group-hover:text-white/70" />
              <div className="flex items-center -space-x-2">
                {item.logos.map((logo) => (
                  <div
                    key={logo.src}
                    className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#111]"
                  >
                    <Image
                      src={logo.src}
                      alt={logo.alt}
                      fill
                      sizes="64px"
                      className="object-contain p-2"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.36em] text-white/35">
                  Organizer
                </p>
                <h3 className="mt-1 pr-8 text-2xl font-black uppercase tracking-[-0.05em] text-white">
                  {item.name}
                </h3>
              </div>
              <p className="mt-4 text-sm leading-7 text-white/55">{item.copy}</p>
            </a>
          ))}
        </div>
      </SectionShell>
    </SectionReveal>
  );
}

function AboutSection() {
  return (
    <SectionReveal id="about" className="scroll-mt-28" delay={0.12}>
      <SectionShell
        eyebrow="About Us"
        title="Who we are."
        copy="Meet the two student communities behind the event."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            {
              title: "AI HackerDorm",
              copy:
                "A community built around practical AI exploration, student-led experimentation, and sharing what works with the people who are already building.",
            },
            {
              title: "Swinburne Computer Science Club",
              copy:
                "A vibrant community for students passionate about coding, technology, and innovation. Open to all backgrounds, we offer hands-on workshops, talks, and networking opportunities to enhance skills and knowledge in computer science and ICT.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-[24px] border border-white/10 bg-black/30 p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.36em] text-white/35">
                Organizer profile
              </p>
              <h3 className="mt-3 text-2xl font-black uppercase tracking-[-0.05em] text-white">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-white/55">{item.copy}</p>
            </div>
          ))}
        </div>
      </SectionShell>
    </SectionReveal>
  );
}

function PartnerSocialSection() {
  return (
    <SectionReveal id="partner" className="scroll-mt-28" delay={0.14}>
      <SectionShell
        eyebrow="Partner + Social"
        title="Support the next generation."
        copy="Want to get involved or follow along? Reach out directly or find us on social media."
      >
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[24px] border border-white/10 bg-black/30 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.36em] text-white/35">
              Partnership notice
            </p>
            <h3 className="mt-3 text-2xl font-black uppercase tracking-[-0.05em] text-white">
              Partnership details coming soon.
            </h3>
            <p className="mt-4 text-sm leading-7 text-white/55">
              Interested in partnering with us? We&apos;re finalizing sponsor and collaboration
              details and will share them soon — reach out via our socials in the meantime.
            </p>
            {/*
            <div className="mt-5 flex flex-wrap gap-3">
              <RegisterCta />
            </div>
            */}
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/30 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.36em] text-white/35">
              Social media
            </p>
            <div className="mt-4 space-y-3">
              {partnerLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.label === "Email" ? undefined : "_blank"}
                  rel={item.label === "Email" ? undefined : "noreferrer"}
                  className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-4 text-white/72 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-white/65">
                      {item.label === "Email" ? (
                        <Mail className="h-4 w-4" />
                      ) : item.label === "LinkedIn" ? (
                        <span className="text-[13px] font-black leading-none tracking-[-0.08em]">
                          in
                        </span>
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-xs text-white/45">{item.handle}</span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </SectionShell>
    </SectionReveal>
  );
}

function WaveZone({
  selectedMilestoneId,
  onSelectMilestone,
}: {
  selectedMilestoneId: string;
  onSelectMilestone: (id: string) => void;
}) {
  const { graphicsEnabled } = useGraphicsMode();
  const { ref, isInView } = useSectionObserver<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className="relative isolate overflow-hidden border-t border-white/10 bg-[#030303] px-4 py-8 sm:px-6 lg:px-8"
    >
      {graphicsEnabled ? (
        <div className="pointer-events-none absolute inset-0 z-0">
          <WaveBackground active={isInView} />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(3,3,3,0.12),rgba(3,3,3,0.78))]" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 z-0 bg-[#030303]" />
      )}

      <div className="relative z-10 mx-auto w-full max-w-7xl space-y-6">
        <SponsorsSection />
        <ScheduleSection selectedId={selectedMilestoneId} onSelect={onSelectMilestone} />
        <BenefitsSection />
        <FaqSection />
        <CollaboratorsSection />
        <AboutSection />
        <PartnerSocialSection />
      </div>
    </div>
  );
}

function LandingContent() {
  const navigate = useScrollToId();
  const countdown = useCountdownState();
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(scheduleItems[0].id);

  const handleWorkshopsClick = () => {
    setSelectedMilestoneId(FIRST_WORKSHOP_ID);
    navigate("schedule");
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#030303] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.09),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.05),transparent_24%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />

      <div className="relative z-10">
        <SiteHeader onNavigate={navigate} stage={countdown.stage} />
        <HeroSection stage={countdown.stage} onWorkshopsClick={handleWorkshopsClick} />
        <CountdownSection stage={countdown.stage} values={countdown.values} />
        <WaveZone
          selectedMilestoneId={selectedMilestoneId}
          onSelectMilestone={setSelectedMilestoneId}
        />
        <SiteFooter />
      </div>
    </main>
  );
}

export function HackathonLandingPage() {
  return (
    <GraphicsModeProvider>
      <LandingContent />
    </GraphicsModeProvider>
  );
}
