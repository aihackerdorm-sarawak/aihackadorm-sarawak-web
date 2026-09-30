export type CountdownPhase =
  | "registration"
  | "main-event"
  | "event-live"
  | "completed";

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export type CountdownStage = {
  phase: CountdownPhase;
  label: string;
  eyebrow: string;
  target: Date;
  completed: boolean;
  message?: string;
};

export const COUNTDOWN_TARGETS = {
  // All times are Malaysia time (UTC+8) - the explicit offset keeps the
  // countdown correct for viewers in any timezone.
  registration: new Date("2026-09-27T00:00:00+08:00"),
  mainEvent: new Date("2026-10-10T09:00:00+08:00"),
  // Submission deadline, 24 hours after the start.
  eventEnds: new Date("2026-10-11T09:00:00+08:00"),
} as const;

function remainingUntil(target: Date, now: number) {
  return target.getTime() - now;
}

export function getCountdownStage(now = Date.now()): CountdownStage {
  if (now < COUNTDOWN_TARGETS.registration.getTime()) {
    return {
      phase: "registration",
      eyebrow: "Countdown to registration opening",
      label: "Registration Opens",
      target: COUNTDOWN_TARGETS.registration,
      completed: false,
    };
  }

  if (now < COUNTDOWN_TARGETS.mainEvent.getTime()) {
    return {
      phase: "main-event",
      eyebrow: "Countdown to hackathon day",
      label: "Hackathon Day",
      target: COUNTDOWN_TARGETS.mainEvent,
      completed: false,
    };
  }

  if (now < COUNTDOWN_TARGETS.eventEnds.getTime()) {
    return {
      phase: "event-live",
      eyebrow: "The hackathon is live",
      label: "Submission Deadline",
      target: COUNTDOWN_TARGETS.eventEnds,
      completed: false,
      message: "Submissions close 11 October, 9:00 AM",
    };
  }

  return {
    phase: "completed",
    eyebrow: "Hackathon complete",
    label: "Hackathon Complete",
    target: COUNTDOWN_TARGETS.eventEnds,
    completed: true,
    message: "AI HackerDorm 2026 — Completed",
  };
}

export function formatCountdownParts(target: Date, now = Date.now()): CountdownParts {
  const remaining = Math.max(0, remainingUntil(target, now));
  const totalSeconds = Math.floor(remaining / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function padTwo(value: number) {
  return String(value).padStart(2, "0");
}


// Hackathon registration is handled on the main AI HackerDorm site — every
// "Register" CTA (and the legacy /register route) points here.
export const HACKATHON_REGISTRATION_URL =
  "https://www.aihackerdorm.com/events/dormathon-2026-malaysia-s-nationwide-hackathon-build-the-next-big-thing";
