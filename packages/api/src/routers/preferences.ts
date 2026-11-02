import { user } from "@todo-task-app/db/schema/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
  parseTasksBoardPrefs,
  tasksBoardPrefsSchema,
} from "../schemas/tasks-board-prefs";

export const DEFAULT_DAILY_CAPACITY_MINUTES = 300;
export const MIN_DAILY_CAPACITY_MINUTES = 120;
export const MAX_DAILY_CAPACITY_MINUTES = 480;

export const dailyCapacityMinutesSchema = z
  .number()
  .int()
  .min(MIN_DAILY_CAPACITY_MINUTES)
  .max(MAX_DAILY_CAPACITY_MINUTES);

const preferencesOutputSchema = z.object({
  dailyCapacityMinutes: dailyCapacityMinutesSchema,
  tasksBoard: tasksBoardPrefsSchema,
});

function normalizeCapacity(value: number | null | undefined): number {
  if (
    typeof value === "number" &&
    value >= MIN_DAILY_CAPACITY_MINUTES &&
    value <= MAX_DAILY_CAPACITY_MINUTES
  ) {
    return value;
  }
  return DEFAULT_DAILY_CAPACITY_MINUTES;
}

export const preferencesRouter = {
  get: protectedProcedure
    .output(preferencesOutputSchema)
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const rows = await context.db
        .select({
          dailyCapacityMinutes: user.dailyCapacityMinutes,
          tasksBoardPrefs: user.tasksBoardPrefs,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const raw = rows[0]?.tasksBoardPrefs ?? null;
      return {
        dailyCapacityMinutes: normalizeCapacity(rows[0]?.dailyCapacityMinutes),
        tasksBoard: parseTasksBoardPrefs(raw),
      };
    }),

  updateDailyCapacity: protectedProcedure
    .input(z.object({ dailyCapacityMinutes: dailyCapacityMinutesSchema }))
    .output(z.object({ dailyCapacityMinutes: dailyCapacityMinutesSchema }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const dailyCapacityMinutes = dailyCapacityMinutesSchema.parse(
        input.dailyCapacityMinutes
      );

      await context.db
        .update(user)
        .set({ dailyCapacityMinutes })
        .where(eq(user.id, userId));

      return { dailyCapacityMinutes };
    }),

  updateTasksBoard: protectedProcedure
    .input(tasksBoardPrefsSchema)
    .output(tasksBoardPrefsSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const prefs = tasksBoardPrefsSchema.parse(input);

      await context.db
        .update(user)
        .set({
          tasksBoardPrefs: JSON.stringify(prefs),
        })
        .where(eq(user.id, userId));

      return prefs;
    }),
};
