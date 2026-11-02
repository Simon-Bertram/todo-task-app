const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const EVERY_DAYS = /^EVERY:(\d+)D$/;

function parseDateOnly(value: string): Date | null {
  if (!DATE_ONLY.test(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function nextWeekday(from: Date): Date {
  let next = addUtcDays(from, 1);
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
    next = addUtcDays(next, 1);
  }
  return next;
}

const WEEKDAY_INDEX: Record<string, number> = {
  FRI: 5,
  MON: 1,
  SAT: 6,
  SUN: 0,
  THU: 4,
  TUE: 2,
  WED: 3,
};

function nextWeeklyDays(from: Date, daysToken: string): Date | null {
  const wanted = daysToken
    .split(",")
    .map((token) => WEEKDAY_INDEX[token.trim().toUpperCase()])
    .filter((value): value is number => value !== undefined);
  if (wanted.length === 0) {
    return null;
  }
  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = addUtcDays(from, offset);
    if (wanted.includes(candidate.getUTCDay())) {
      return candidate;
    }
  }
  return null;
}

/**
 * Compute the next due date for a recurrence rule after completing a task.
 * Returns null when the rule is unsupported or incomplete.
 */
export function nextDueDateForRecurrence(
  rule: string | null | undefined,
  fromDueDate: string | null | undefined,
  completedOn: Date = new Date()
): string | null {
  if (!rule) {
    return null;
  }

  const normalized = rule.trim().toUpperCase();
  const base =
    (fromDueDate ? parseDateOnly(fromDueDate) : null) ??
    new Date(
      Date.UTC(
        completedOn.getUTCFullYear(),
        completedOn.getUTCMonth(),
        completedOn.getUTCDate()
      )
    );

  if (normalized === "DAILY") {
    return formatDateOnly(addUtcDays(base, 1));
  }

  if (normalized === "WEEKDAYS") {
    return formatDateOnly(nextWeekday(base));
  }

  if (normalized === "WEEKLY") {
    return formatDateOnly(addUtcDays(base, 7));
  }

  if (normalized.startsWith("WEEKLY:")) {
    const days = normalized.slice("WEEKLY:".length);
    const next = nextWeeklyDays(base, days);
    return next ? formatDateOnly(next) : null;
  }

  if (normalized === "MONTHLY") {
    const next = new Date(base.getTime());
    next.setUTCMonth(next.getUTCMonth() + 1);
    return formatDateOnly(next);
  }

  const everyMatch = EVERY_DAYS.exec(normalized);
  if (everyMatch?.[1]) {
    const interval = Number(everyMatch[1]);
    if (interval > 0) {
      return formatDateOnly(addUtcDays(base, interval));
    }
  }

  return null;
}
