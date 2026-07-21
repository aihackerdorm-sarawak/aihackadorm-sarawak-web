"use client";

import { Component, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ExternalLink, Mail, Sparkles, Trophy } from "lucide-react";
import { GraphicsModeProvider, useGraphicsMode } from "./GraphicsMode";
import { SectionReveal } from "./SectionReveal";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { CountdownScene } from "./CountdownScene";
import WaveBackground from "./WaveBackground";
import { formatCountdownParts, getCountdownStage, padTwo } from "@/lib/countdown";

type ScheduleItem = {
  id: string;
  label: string;
  date: string;
  hint: string;
  title: string;
  copy: string;
  badge?: string;
  status?: string;
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
    label: "Pre-Hackathon Workshop",
    date: "Oct 2, 2026",
    hint: "Tentative",
    title: "Pre-hackathon workshop",
    copy:
      "A tentative warm-up session to help teams prepare, meet mentors, and calibrate ideas before the main build window.",
    badge: "Tentative",
  },
  {
    id: "main-event",
    label: "Main Event",
    date: "Oct 10, 2026",
    hint: "Build begins",
    title: "Main event begins",
    copy:
      "The main hackathon start date. The countdown then shifts into the 48-hour live event window until completion.",
    status: "2-day event",
  },
];

const benefitCards = [
  "To Be Announced",
  "To Be Announced",
  "To Be Announced",
  "To Be Announced",
  "To Be Announced",
  "To Be Announced",
];

const partnerLinks = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/borneo-hackathon-6b80bb421" },
  { label: "Instagram", href: "https://www.instagram.com/ai_hackerdorm_sarawak/" },
  { label: "Email", href: "mailto:example@gmail.com" },
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
      {
        threshold: 0.08,
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
        <p className="font-mono text-[10px] uppercase tracking-[0.42em] text-white/35">{eyebrow}</p>
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
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "Coming Soon" : undefined}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-75"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}

function CountdownLabels() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 px-4 sm:top-5 sm:px-6">
      <div className="grid gap-4 text-center md:grid-cols-4">
        {[
          ["days", "Days"],
          ["hours", "Hours"],
          ["minutes", "Mins"],
          ["seconds", "Secs"],
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

    const update = (entry: ResizeObserverEntry) => {
      setContainerWidthPx(entry.contentRect.width);
      setContainerHeightPx(entry.contentRect.height);
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        update(entry);
      }
    });

    const rect = element.getBoundingClientRect();
    setContainerWidthPx(rect.width);
    setContainerHeightPx(rect.height);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      className="relative min-h-[300px] overflow-hidden rounded-[30px] bg-black/40"
    >
      <CountdownLabels />
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
        ["days", "Days"],
        ["hours", "Hours"],
        ["minutes", "Mins"],
        ["seconds", "Secs"],
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

function CountdownSection() {
  const reducedMotion = useReducedMotion() ?? true;
  const { graphicsEnabled } = useGraphicsMode();
  const { ref, isInView } = useSectionObserver<HTMLDivElement>();
  const { stage, values } = useCountdownState();
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeightPx, setHeaderHeightPx] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsMounted(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

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
          <p className="font-mono text-[10px] uppercase tracking-[0.42em] text-white/35">
            Countdown
          </p>
          <h2 className="text-4xl font-black uppercase tracking-[-0.08em] text-white sm:text-6xl lg:text-7xl">
            {stage.completed ? "The event has finished." : `Counting down to ${stage.label}.`}
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-white/55 sm:text-base">
            {stage.eyebrow}.{" "}
            {stage.phase === "event-live"
              ? "The final phase is a 48-hour live event window before the page flips to the completed state."
              : "The chain advances automatically from registration, to workshop, to the main event, and then to completion."}
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
              quality="medium"
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

function HeroSection() {
  const reducedMotion = useReducedMotion() ?? true;
  const navigate = useScrollToId();

  return (
    <section id="hero" className="relative overflow-hidden px-4 pb-14 pt-10 sm:px-6 sm:pb-16 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
        <div className="max-w-3xl space-y-6">
          <motion.p
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-mono text-[10px] uppercase tracking-[0.48em] text-white/35"
          >
            Oct 10-11, 2026 - Kuching, Sarawak - 48 hours
          </motion.p>

          <motion.h1
            initial={reducedMotion ? false : { opacity: 0, y: 14, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl text-[clamp(3.2rem,11vw,7.8rem)] font-black uppercase leading-[0.86] tracking-[-0.08em] text-white"
          >
            <span className="block">Build the</span>
            <span className="block text-white/22">future</span>
            <span className="block">with AI.</span>
          </motion.h1>

          <motion.p
            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="max-w-2xl text-sm leading-7 text-white/55 sm:text-base"
          >
            AI Hackadorm Sarawak is a 24-hour hackathon by Swinburne University Sarawak and AI
            HackerDorm. Students and developers build real AI solutions under one roof in Kuching,
            Borneo.
          </motion.p>

          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton disabled>Coming Soon</PrimaryButton>
            <button
              type="button"
              onClick={() => navigate("schedule")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              Learn More
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-[30rem]">
          {[
            { label: "Hackathon", value: "24h" },
            { label: "Format", value: "Build + mentor" },
            { label: "Location", value: "Kuching" },
            { label: "Focus", value: "AI solutions" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.36em] text-white/35">
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
        copy="This section is intentionally present in the launch build, but the logos are placeholders until sponsor assets are confirmed."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {["Logo TBC", "Logo TBC", "Logo TBC", "Logo TBC"].map((label, index) => (
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

function ScheduleSection() {
  const [selectedId, setSelectedId] = useState(scheduleItems[0].id);
  const selected = scheduleItems.find((item) => item.id === selectedId) ?? scheduleItems[0];

  return (
    <SectionReveal id="schedule" className="scroll-mt-28" delay={0.06}>
      <SectionShell
        eyebrow="Schedule"
        title="Key dates."
        copy="Tap a milestone to update the single shared detail card below."
      >
        <div className="space-y-6">
          <div className="overflow-x-auto pb-4">
            <div className="relative min-w-[620px] px-3 py-10">
              <div className="absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-white/15" />
              <div className="grid grid-cols-3 gap-4">
                {scheduleItems.map((item) => {
                  const active = item.id === selectedId;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      aria-pressed={active}
                      className="relative flex min-h-28 flex-col items-center justify-center text-center"
                    >
                      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                        <span
                          className={`block h-4 w-4 rounded-full border transition-all ${
                            active
                              ? "border-white bg-white shadow-[0_0_0_6px_rgba(255,255,255,0.08)]"
                              : "border-white/45 bg-[#030303]"
                          }`}
                        />
                      </div>

                      <div className="mb-auto flex flex-col items-center gap-2 px-3">
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
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.36em] text-white/35">
                  Shared detail card
                </p>
                <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-white">
                  {selected.title}
                </h3>
              </div>
              {selected.badge ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] uppercase tracking-[0.28em] text-white/45">
                  {selected.badge}
                </span>
              ) : null}
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/55">{selected.copy}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-white/32">
              <span>{selected.date}</span>
              <span>-</span>
              <span>{selected.status ?? "Tentative"}</span>
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
        copy="Real prize details are not ready yet, so the live build shows the actual visible launch copy: To Be Announced."
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

function CollaboratorsSection() {
  return (
    <SectionReveal id="collaborators" className="scroll-mt-28" delay={0.1}>
      <SectionShell
        eyebrow="Collaborators"
        title="AI HackerDorm x Swinburne"
        copy="Two organizers, one shared build room."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              name: "AI HackerDorm",
              logo: "/AI-Hackadorm.png",
              copy: "Student-led community focused on building AI capability, momentum, and useful collaboration across the region.",
            },
            {
              name: "Swinburne Sarawak",
              logo: "/Swinburne-Logo.jpg",
              copy: "University partner bringing academic support, venue context, and a pathway to student participation.",
            },
          ].map((item) => (
            <div key={item.name} className="rounded-[24px] border border-white/10 bg-black/30 p-5">
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
                  <Image
                    src={item.logo}
                    alt={item.name}
                    fill
                    sizes="64px"
                    className="object-contain p-2"
                  />
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.36em] text-white/35">
                    Organizer
                  </p>
                  <h3 className="mt-1 text-2xl font-black uppercase tracking-[-0.05em] text-white">
                    {item.name}
                  </h3>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-white/55">{item.copy}</p>
            </div>
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
        copy="This section stays modular so it can grow later without forcing a route change."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            {
              title: "AI HackerDorm",
              copy:
                "A community built around practical AI exploration, student-led experimentation, and sharing what works with the people who are already building.",
            },
            {
              title: "Swinburne University Sarawak",
              copy:
                "An academic partner supporting the hackathon with an environment that can connect students, mentors, and collaborators in one place.",
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
        copy="Partnership inquiries stay lightweight for launch: no form, just direct contact channels and social links."
      >
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[24px] border border-white/10 bg-black/30 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.36em] text-white/35">
              Partnership notice
            </p>
            <h3 className="mt-3 text-2xl font-black uppercase tracking-[-0.05em] text-white">
              Placeholders only for now.
            </h3>
            <p className="mt-4 text-sm leading-7 text-white/55">
              If your organization wants to collaborate, this is the launch placeholder. We will
              swap in the final sponsor and partnership messaging once those details are confirmed.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <PrimaryButton disabled>Coming Soon</PrimaryButton>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
              >
                Contact channels
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
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
                      {item.label === "Email" ? <Mail className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    </span>
                    <span className="text-sm font-medium">{item.label}</span>
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

function WaveZone() {
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
        <ScheduleSection />
        <BenefitsSection />
        <CollaboratorsSection />
        <AboutSection />
        <PartnerSocialSection />
      </div>
    </div>
  );
}

function LandingContent() {
  const navigate = useScrollToId();

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#030303] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.09),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.05),transparent_24%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />

      <div className="relative z-10">
        <SiteHeader onNavigate={navigate} />
        <HeroSection />
        <CountdownSection />
        <WaveZone />
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
