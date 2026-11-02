import { z } from "zod";

export const tasksBoardSortSchema = z.enum([
  "due",
  "importance",
  "urgency",
  "title",
]);

export const tasksBoardDueSchema = z.enum([
  "all",
  "overdue",
  "today",
  "upcoming",
  "none",
]);

export const tasksBoardPriorityMinSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const tasksBoardPrefsSchema = z.object({
  due: tasksBoardDueSchema.default("all"),
  importanceMin: tasksBoardPriorityMinSchema.nullable().default(null),
  project: z.string().nullable().default(null),
  sort: tasksBoardSortSchema.default("due"),
  urgencyMin: tasksBoardPriorityMinSchema.nullable().default(null),
});

export type TasksBoardPrefs = z.infer<typeof tasksBoardPrefsSchema>;

export const DEFAULT_TASKS_BOARD_PREFS: TasksBoardPrefs = {
  due: "all",
  importanceMin: null,
  project: null,
  sort: "due",
  urgencyMin: null,
};

export function parseTasksBoardPrefs(
  raw: string | null | undefined
): TasksBoardPrefs {
  if (!raw) {
    return { ...DEFAULT_TASKS_BOARD_PREFS };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const result = tasksBoardPrefsSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  } catch {
    // Invalid JSON — fall through to defaults.
  }

  return { ...DEFAULT_TASKS_BOARD_PREFS };
}
