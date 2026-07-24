export type CountdownPhase =
  | "registration"
  | "workshop"
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
  registration: new Date("2026-07-24T15:30:00"),
  workshop: new Date("2026-10-02T00:00:00"),
  mainEvent: new Date("2026-10-10T00:00:00"),
  eventEnds: new Date("2026-10-11T00:00:00"),
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

  if (now < COUNTDOWN_TARGETS.workshop.getTime()) {
    return {
      phase: "workshop",
      eyebrow: "Countdown to pre-hackathon workshop",
      label: "Pre-Hackathon Workshop",
      target: COUNTDOWN_TARGETS.workshop,
      completed: false,
    };
  }

  if (now < COUNTDOWN_TARGETS.mainEvent.getTime()) {
    return {
      phase: "main-event",
      eyebrow: "Countdown to the main event",
      label: "Main Event",
      target: COUNTDOWN_TARGETS.mainEvent,
      completed: false,
    };
  }

  if (now < COUNTDOWN_TARGETS.eventEnds.getTime()) {
    return {
      phase: "event-live",
      eyebrow: "The main event is live",
      label: "Event Completion",
      target: COUNTDOWN_TARGETS.eventEnds,
      completed: false,
      message: "24 hours remaining",
    };
  }

  return {
    phase: "completed",
    eyebrow: "Season complete",
    label: "AI HackerDorm 2026",
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

