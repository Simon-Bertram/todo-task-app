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

export const celebrationsSchema = z.enum(["subtle", "off"]);
export const taskProgressControlSchema = z.enum(["pie", "slider"]);

const preferencesOutputSchema = z.object({
  celebrations: celebrationsSchema,
  dailyCapacityMinutes: dailyCapacityMinutesSchema,
  onboardingCompletedAt: z.date().nullable(),
  rhythmBest: z.number().int(),
  rhythmCurrent: z.number().int(),
  rhythmOptIn: z.boolean(),
  taskProgressControl: taskProgressControlSchema,
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
  completeOnboarding: protectedProcedure
    .output(z.object({ onboardingCompletedAt: z.date() }))
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const onboardingCompletedAt = new Date();
      await context.db
        .update(user)
        .set({ onboardingCompletedAt })
        .where(eq(user.id, userId));
      return { onboardingCompletedAt };
    }),
  get: protectedProcedure
    .output(preferencesOutputSchema)
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const rows = await context.db
        .select({
          celebrations: user.celebrations,
          dailyCapacityMinutes: user.dailyCapacityMinutes,
          onboardingCompletedAt: user.onboardingCompletedAt,
          rhythmBest: user.rhythmBest,
          rhythmCurrent: user.rhythmCurrent,
          rhythmOptIn: user.rhythmOptIn,
          taskProgressControl: user.taskProgressControl,
          tasksBoardPrefs: user.tasksBoardPrefs,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const [row] = rows;
      const raw = row?.tasksBoardPrefs ?? null;
      const celebrationsParsed = celebrationsSchema.safeParse(
        row?.celebrations
      );
      const taskProgressParsed = taskProgressControlSchema.safeParse(
        row?.taskProgressControl
      );
      return {
        celebrations: celebrationsParsed.success
          ? celebrationsParsed.data
          : "subtle",
        dailyCapacityMinutes: normalizeCapacity(row?.dailyCapacityMinutes),
        onboardingCompletedAt: row?.onboardingCompletedAt ?? null,
        rhythmBest: row?.rhythmBest ?? 0,
        rhythmCurrent: row?.rhythmCurrent ?? 0,
        rhythmOptIn: row?.rhythmOptIn ?? false,
        taskProgressControl: taskProgressParsed.success
          ? taskProgressParsed.data
          : "pie",
        tasksBoard: parseTasksBoardPrefs(raw),
      };
    }),

  updateCelebrations: protectedProcedure
    .input(z.object({ celebrations: celebrationsSchema }))
    .output(z.object({ celebrations: celebrationsSchema }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await context.db
        .update(user)
        .set({ celebrations: input.celebrations })
        .where(eq(user.id, userId));
      return { celebrations: input.celebrations };
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

  updateTaskProgressControl: protectedProcedure
    .input(z.object({ taskProgressControl: taskProgressControlSchema }))
    .output(z.object({ taskProgressControl: taskProgressControlSchema }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await context.db
        .update(user)
        .set({ taskProgressControl: input.taskProgressControl })
        .where(eq(user.id, userId));
      return { taskProgressControl: input.taskProgressControl };
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
