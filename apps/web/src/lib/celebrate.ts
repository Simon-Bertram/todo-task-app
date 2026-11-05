import { getCapacityBucket } from "./quadrant";

export type CelebrationIntensity = "default" | "major" | "dayProtected";

const CELEBRATIONS_KEY = "plansage-celebrations";

export function completionIntensity(options: {
  budgetMinutes: number;
  estimatedMinutes: number;
  isToday: boolean;
  plannedMinutes: number;
  remainingTodayCount: number;
}): CelebrationIntensity {
  if (
    options.isToday &&
    options.remainingTodayCount === 0 &&
    options.plannedMinutes <= options.budgetMinutes
  ) {
    return "dayProtected";
  }
  if (getCapacityBucket(options.estimatedMinutes) === "major") {
    return "major";
  }
  return "default";
}

export type CelebrationsPref = "subtle" | "off";

export function getCelebrationsPref(): CelebrationsPref {
  if (typeof window === "undefined") {
    return "subtle";
  }
  const stored = window.localStorage.getItem(CELEBRATIONS_KEY);
  if (stored === "off" || stored === "subtle") {
    return stored;
  }
  return "subtle";
}

export function setCelebrationsPref(value: CelebrationsPref): void {
  window.localStorage.setItem(CELEBRATIONS_KEY, value);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const THEME_COLORS = ["#10b981", "#f43f5e", "#3b82f6", "#f59e0b"];

export async function celebrateTaskComplete(
  intensity: CelebrationIntensity = "default"
): Promise<void> {
  if (getCelebrationsPref() === "off" || prefersReducedMotion()) {
    return;
  }

  const confetti = (await import("canvas-confetti")).default;

  let particleCount = 55;
  let spread = 55;
  if (intensity === "major") {
    particleCount = 80;
    spread = 70;
  } else if (intensity === "dayProtected") {
    particleCount = 100;
    spread = 80;
  }

  confetti({
    colors: THEME_COLORS,
    disableForReducedMotion: true,
    origin: { x: 0.5, y: 0.35 },
    particleCount,
    spread,
    startVelocity: intensity === "default" ? 28 : 35,
  });
}
