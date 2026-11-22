export const RECURRENCE_WEEKDAYS = [
  { label: "Mon", value: "MON" },
  { label: "Tue", value: "TUE" },
  { label: "Wed", value: "WED" },
  { label: "Thu", value: "THU" },
  { label: "Fri", value: "FRI" },
  { label: "Sat", value: "SAT" },
  { label: "Sun", value: "SUN" },
] as const;

export type RecurrenceWeekday = (typeof RECURRENCE_WEEKDAYS)[number]["value"];

export type RecurrenceMode =
  | "none"
  | "DAILY"
  | "WEEKDAYS"
  | "WEEKLY"
  | "WEEKLY_DAYS"
  | "MONTHLY"
  | "EVERY";

export interface RecurrenceFormState {
  everyDays: number;
  mode: RecurrenceMode;
  weeklyDays: RecurrenceWeekday[];
}

const EVERY_DAYS = /^EVERY:(?<interval>\d+)D$/u;
const WEEKLY_DAYS = /^WEEKLY:(?<days>[A-Z,]+)$/u;

export function parseRecurrenceRule(
  rule: string | null | undefined
): RecurrenceFormState {
  if (!rule) {
    return { everyDays: 3, mode: "none", weeklyDays: ["MON"] };
  }

  const normalized = rule.trim().toUpperCase();
  if (normalized === "DAILY") {
    return { everyDays: 3, mode: "DAILY", weeklyDays: ["MON"] };
  }
  if (normalized === "WEEKDAYS") {
    return { everyDays: 3, mode: "WEEKDAYS", weeklyDays: ["MON"] };
  }
  if (normalized === "WEEKLY") {
    return { everyDays: 3, mode: "WEEKLY", weeklyDays: ["MON"] };
  }
  if (normalized === "MONTHLY") {
    return { everyDays: 3, mode: "MONTHLY", weeklyDays: ["MON"] };
  }

  const weeklyMatch = WEEKLY_DAYS.exec(normalized);
  const weeklyDaysToken = weeklyMatch?.groups?.days;
  if (weeklyDaysToken) {
    const days = weeklyDaysToken
      .split(",")
      .map((token) => token.trim())
      .filter((token): token is RecurrenceWeekday =>
        RECURRENCE_WEEKDAYS.some((day) => day.value === token)
      );
    return {
      everyDays: 3,
      mode: "WEEKLY_DAYS",
      weeklyDays: days.length > 0 ? days : ["MON"],
    };
  }

  const everyMatch = EVERY_DAYS.exec(normalized);
  const everyInterval = everyMatch?.groups?.interval;
  if (everyInterval) {
    const interval = Number(everyInterval);
    return {
      everyDays: interval > 0 ? interval : 3,
      mode: "EVERY",
      weeklyDays: ["MON"],
    };
  }

  return { everyDays: 3, mode: "none", weeklyDays: ["MON"] };
}

export function buildRecurrenceRule(state: RecurrenceFormState): string | null {
  switch (state.mode) {
    case "none":
      return null;
    case "DAILY":
      return "DAILY";
    case "WEEKDAYS":
      return "WEEKDAYS";
    case "WEEKLY":
      return "WEEKLY";
    case "MONTHLY":
      return "MONTHLY";
    case "WEEKLY_DAYS": {
      const days = RECURRENCE_WEEKDAYS.map((day) => day.value).filter((day) =>
        state.weeklyDays.includes(day)
      );
      if (days.length === 0) {
        return "WEEKLY";
      }
      return `WEEKLY:${days.join(",")}`;
    }
    case "EVERY": {
      const interval = Math.max(1, Math.min(365, Math.floor(state.everyDays)));
      return `EVERY:${interval}D`;
    }
    default:
      return null;
  }
}

export function recurrenceSummary(state: RecurrenceFormState): string {
  switch (state.mode) {
    case "none":
      return "None";
    case "DAILY":
      return "Daily";
    case "WEEKDAYS":
      return "Weekdays";
    case "WEEKLY":
      return "Weekly";
    case "MONTHLY":
      return "Monthly";
    case "WEEKLY_DAYS": {
      const labels = RECURRENCE_WEEKDAYS.filter((day) =>
        state.weeklyDays.includes(day.value)
      ).map((day) => day.label);
      return labels.length > 0 ? `Weekly · ${labels.join(", ")}` : "Weekly";
    }
    case "EVERY":
      return `Every ${Math.max(1, state.everyDays)} days`;
    default:
      return "None";
  }
}
