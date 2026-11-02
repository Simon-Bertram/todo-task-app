export const COMPLETED_RANGES = [
  "this_week",
  "last_week",
  "last_month",
  "last_year",
  "all",
] as const;

export type CompletedRange = (typeof COMPLETED_RANGES)[number];

export interface DateBounds {
  endMs: number | null;
  startMs: number | null;
}

interface ZonedParts {
  day: number;
  month: number;
  weekday: number;
  year: number;
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Fri: 5,
  Mon: 1,
  Sat: 6,
  Sun: 0,
  Thu: 4,
  Tue: 2,
  Wed: 3,
};

function parseZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    weekday: "short",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekdayLabel = get("weekday");
  const weekday = WEEKDAY_TO_INDEX[weekdayLabel];
  if (weekday === undefined) {
    throw new Error(`Unexpected weekday: ${weekdayLabel}`);
  }

  return {
    day: Number(get("day")),
    month: Number(get("month")),
    weekday,
    year: Number(get("year")),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - date.getTime();
}

/** Instant for local Y-M-D H:M:S.ms in `timeZone`. */
export function zonedLocalToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string
): number {
  const utcGuess = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond
  );
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const adjusted = new Date(utcGuess - offset);
  const offset2 = getTimeZoneOffsetMs(adjusted, timeZone);
  return utcGuess - offset2;
}

function addDays(year: number, month: number, day: number, delta: number) {
  const base = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    day: base.getUTCDate(),
    month: base.getUTCMonth() + 1,
    year: base.getUTCFullYear(),
  };
}

function endOfLocalDayMs(
  year: number,
  month: number,
  day: number,
  timeZone: string
): number {
  const next = addDays(year, month, day, 1);
  return startOfLocalDayMs(next.year, next.month, next.day, timeZone) - 1;
}

function startOfLocalDayMs(
  year: number,
  month: number,
  day: number,
  timeZone: string
): number {
  return zonedLocalToUtcMs(year, month, day, 0, 0, 0, 0, timeZone);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Compute inclusive completed_at bounds for a Complete view range
 * in the viewer's IANA time zone.
 */
export function completedRangeBounds(
  range: CompletedRange,
  timeZone: string,
  now: Date = new Date()
): DateBounds {
  if (range === "all") {
    return { endMs: null, startMs: null };
  }

  const today = parseZonedParts(now, timeZone);

  if (range === "this_week") {
    const daysFromMonday = (today.weekday + 6) % 7;
    const monday = addDays(today.year, today.month, today.day, -daysFromMonday);
    return {
      endMs: endOfLocalDayMs(today.year, today.month, today.day, timeZone),
      startMs: startOfLocalDayMs(
        monday.year,
        monday.month,
        monday.day,
        timeZone
      ),
    };
  }

  if (range === "last_week") {
    const daysFromMonday = (today.weekday + 6) % 7;
    const thisMonday = addDays(
      today.year,
      today.month,
      today.day,
      -daysFromMonday
    );
    const lastMonday = addDays(
      thisMonday.year,
      thisMonday.month,
      thisMonday.day,
      -7
    );
    const lastFriday = addDays(
      lastMonday.year,
      lastMonday.month,
      lastMonday.day,
      4
    );
    return {
      endMs: endOfLocalDayMs(
        lastFriday.year,
        lastFriday.month,
        lastFriday.day,
        timeZone
      ),
      startMs: startOfLocalDayMs(
        lastMonday.year,
        lastMonday.month,
        lastMonday.day,
        timeZone
      ),
    };
  }

  if (range === "last_month") {
    const prevMonth = today.month === 1 ? 12 : today.month - 1;
    const prevYear = today.month === 1 ? today.year - 1 : today.year;
    const lastDay = daysInMonth(prevYear, prevMonth);
    return {
      endMs: endOfLocalDayMs(prevYear, prevMonth, lastDay, timeZone),
      startMs: startOfLocalDayMs(prevYear, prevMonth, 1, timeZone),
    };
  }

  // last_year
  const prevYear = today.year - 1;
  return {
    endMs: endOfLocalDayMs(prevYear, 12, 31, timeZone),
    startMs: startOfLocalDayMs(prevYear, 1, 1, timeZone),
  };
}

export function localDateString(date: Date, timeZone: string): string {
  const parts = parseZonedParts(date, timeZone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}
