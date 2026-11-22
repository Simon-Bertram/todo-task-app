export const COMPLETED_RANGE_OPTIONS = [
  { id: "this_week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "last_month", label: "Last month" },
  { id: "last_year", label: "Last year" },
  { id: "all", label: "All time" },
] as const;

export type CompletedRangeId = (typeof COMPLETED_RANGE_OPTIONS)[number]["id"];

export function parseCompletedRange(value: string | null): CompletedRangeId {
  const match = COMPLETED_RANGE_OPTIONS.find((option) => option.id === value);
  return match?.id ?? "this_week";
}

export function emptyStateForRange(range: CompletedRangeId): string {
  switch (range) {
    case "this_week":
      return "No completions this week.";
    case "last_week":
      return "No completions last week (Mon–Fri).";
    case "last_month":
      return "No completions last month.";
    case "last_year":
      return "No completions last year.";
    default:
      return "No completed tasks yet.";
  }
}

export function formatCompletedAt(
  value: Date | string | null | undefined,
  timeZone: string
): string {
  if (!value) {
    return "";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}
