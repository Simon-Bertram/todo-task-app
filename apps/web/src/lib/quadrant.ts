import {
  type CapacityBucket as ApiCapacityBucket,
  getCapacityBucket as resolveCapacityBucket,
} from "@todo-task-app/api/lib/capacity-bucket";
import {
  type QuadrantId as ApiQuadrantId,
  getQuadrant as resolveQuadrant,
} from "@todo-task-app/api/lib/quadrant";

export type CapacityBucket = ApiCapacityBucket;
export type QuadrantId = ApiQuadrantId;

export function getQuadrant(isUrgent: number, isImportant: number): QuadrantId {
  return resolveQuadrant(isUrgent, isImportant);
}

export function getCapacityBucket(estimatedMinutes: number): CapacityBucket {
  return resolveCapacityBucket(estimatedMinutes);
}

export interface QuadrantMeta {
  accentClass: string;
  colorVar: string;
  id: QuadrantId;
  intent: string;
  label: string;
  tintClass: string;
}

export const QUADRANT_META: Record<QuadrantId, QuadrantMeta> = {
  Q1: {
    accentClass: "accent-q1",
    colorVar: "var(--color-q1)",
    id: "Q1",
    intent: "Crises, deadlines, blockers",
    label: "Do First",
    tintClass: "tint-q1",
  },
  Q2: {
    accentClass: "accent-q2",
    colorVar: "var(--color-q2)",
    id: "Q2",
    intent: "Strategic deep work",
    label: "Schedule",
    tintClass: "tint-q2",
  },
  Q3: {
    accentClass: "accent-q3",
    colorVar: "var(--color-q3)",
    id: "Q3",
    intent: "Interruptions to delegate",
    label: "Streamline",
    tintClass: "tint-q3",
  },
  Q4: {
    accentClass: "accent-q4",
    colorVar: "var(--color-q4)",
    id: "Q4",
    intent: "Low-impact backlog",
    label: "Drop",
    tintClass: "tint-q4",
  },
};

export function defaultRatingsForQuadrant(quadrant: QuadrantId): {
  isImportant: number;
  isUrgent: number;
} {
  switch (quadrant) {
    case "Q1":
      return { isImportant: 2, isUrgent: 2 };
    case "Q2":
      return { isImportant: 2, isUrgent: 1 };
    case "Q3":
      return { isImportant: 1, isUrgent: 2 };
    case "Q4":
      return { isImportant: 1, isUrgent: 1 };
    default:
      return { isImportant: 1, isUrgent: 1 };
  }
}

export function formatMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return `${hours}h ${rem}m`;
  }
  return `${minutes}m`;
}

export type CapacityTone = "ok" | "warn" | "over";

export function capacityTone(
  plannedMinutes: number,
  budgetMinutes: number
): CapacityTone {
  const ratio = plannedMinutes / budgetMinutes;
  if (ratio > 1) {
    return "over";
  }
  if (ratio >= 0.75) {
    return "warn";
  }
  return "ok";
}

/** Text color class for capacity tone (shared by Today + Matrix dock). */
export function capacityToneTextClass(tone: CapacityTone): string {
  if (tone === "over") {
    return "text-capacity-over";
  }
  if (tone === "warn") {
    return "text-capacity-warn";
  }
  return "text-capacity-ok";
}

/** Bar fill class for capacity tone. */
export function capacityToneBarClass(tone: CapacityTone): string {
  if (tone === "over") {
    return "bg-capacity-over";
  }
  if (tone === "warn") {
    return "bg-capacity-warn";
  }
  return "bg-capacity-ok";
}
