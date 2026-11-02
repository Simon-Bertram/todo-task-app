export type DueReminderStatus =
  | "none"
  | "upcoming"
  | "soon"
  | "today"
  | "overdue";

export const DUE_SOON_DAYS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(value: string): Date | null {
  if (!DATE_ONLY.test(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function daysBetween(from: string, to: string): number | null {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!(start && end)) {
    return null;
  }
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

export function getDueReminderStatus(
  dueDate: string | null,
  today: string,
  soonDays: number = DUE_SOON_DAYS
): DueReminderStatus {
  if (!dueDate) {
    return "none";
  }
  const delta = daysBetween(today, dueDate);
  if (delta === null) {
    return "none";
  }
  if (delta < 0) {
    return "overdue";
  }
  if (delta === 0) {
    return "today";
  }
  if (delta <= soonDays) {
    return "soon";
  }
  return "upcoming";
}

export function getDueReminderLabel(
  status: DueReminderStatus,
  dueDate: string | null,
  today: string
): string | null {
  if (!dueDate || status === "none" || status === "upcoming") {
    return null;
  }
  if (status === "overdue") {
    const delta = daysBetween(dueDate, today);
    if (delta === null) {
      return "Overdue";
    }
    if (delta === 1) {
      return "Overdue by 1 day";
    }
    return `Overdue by ${delta} days`;
  }
  if (status === "today") {
    return "Due today";
  }
  const delta = daysBetween(today, dueDate);
  if (delta === 1) {
    return "Due in 1 day";
  }
  return `Due in ${delta} days`;
}

export function getDueReminderColor(status: DueReminderStatus): string {
  if (status === "overdue") {
    return "var(--color-capacity-over)";
  }
  if (status === "today") {
    return "var(--color-capacity-warn)";
  }
  if (status === "soon") {
    return "var(--color-primary)";
  }
  return "var(--color-text-muted)";
}

export function countDueReminders(
  tasks: Array<{ dueDate: string | null; isCompleted: boolean }>,
  today: string
): { overdue: number; soon: number; today: number } {
  let overdue = 0;
  let dueToday = 0;
  let soon = 0;
  for (const task of tasks) {
    if (task.isCompleted) {
      continue;
    }
    const status = getDueReminderStatus(task.dueDate, today);
    if (status === "overdue") {
      overdue += 1;
    } else if (status === "today") {
      dueToday += 1;
    } else if (status === "soon") {
      soon += 1;
    }
  }
  return { overdue, soon, today: dueToday };
}

export function buildMonthGrid(
  year: number,
  monthIndex: number
): Array<Date | null> {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startWeekday = first.getDay();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, monthIndex, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const WEEKDAY_LABELS = [
  "Su",
  "Mo",
  "Tu",
  "We",
  "Th",
  "Fr",
  "Sa",
] as const;
