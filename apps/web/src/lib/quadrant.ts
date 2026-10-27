export type QuadrantId = "Q1" | "Q2" | "Q3" | "Q4";

export type CapacityBucket = "major" | "medium" | "quick" | "other";

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

export function getQuadrant(isUrgent: number, isImportant: number): QuadrantId {
  const urgent = isUrgent >= 2;
  const important = isImportant >= 2;
  if (urgent && important) {
    return "Q1";
  }
  if (!urgent && important) {
    return "Q2";
  }
  if (urgent && !important) {
    return "Q3";
  }
  return "Q4";
}

export function defaultRatingsForQuadrant(quadrant: QuadrantId): {
  isUrgent: number;
  isImportant: number;
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

export function getCapacityBucket(estimatedMinutes: number): CapacityBucket {
  if (estimatedMinutes >= 60 && estimatedMinutes <= 120) {
    return "major";
  }
  if (estimatedMinutes >= 30 && estimatedMinutes < 60) {
    return "medium";
  }
  if (estimatedMinutes > 0 && estimatedMinutes < 15) {
    return "quick";
  }
  // 15–29m and >120m fall outside strict 1-3-5 bands; treat 15 as quick-adjacent
  if (estimatedMinutes <= 15) {
    return "quick";
  }
  if (estimatedMinutes < 60) {
    return "medium";
  }
  return "major";
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

export function capacityTone(
  plannedMinutes: number,
  budgetMinutes: number
): "ok" | "warn" | "over" {
  const ratio = plannedMinutes / budgetMinutes;
  if (ratio > 1) {
    return "over";
  }
  if (ratio >= 0.75) {
    return "warn";
  }
  return "ok";
}
