import { user } from "@todo-task-app/db/schema/auth";
import {
  userDayStats,
  userMilestones,
} from "@todo-task-app/db/schema/gamification";
import { tasks } from "@todo-task-app/db/schema/tasks";
import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { localDateString, zonedLocalToUtcMs } from "../lib/completed-range";
import { MILESTONE_KEYS, MILESTONE_LABELS } from "../lib/milestones";
import { getQuadrant } from "../lib/quadrant";
import { countProtectedDaysInRange } from "../lib/rhythm";

const timeZoneSchema = z.string().min(1).max(100);

function addDays(localDate: string, delta: number): string {
  const [year, month, day] = localDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeekMonday(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay();
  const daysFromMonday = (weekday + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - daysFromMonday);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const gamificationRouter = {
  getRhythm: protectedProcedure
    .output(
      z.object({
        best: z.number().int(),
        current: z.number().int(),
        optIn: z.boolean(),
        paused: z.boolean(),
      })
    )
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const rows = await context.db
        .select({
          rhythmBest: user.rhythmBest,
          rhythmCurrent: user.rhythmCurrent,
          rhythmOptIn: user.rhythmOptIn,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      const [row] = rows;
      const optIn = row?.rhythmOptIn ?? false;
      const current = row?.rhythmCurrent ?? 0;
      return {
        best: row?.rhythmBest ?? 0,
        current,
        optIn,
        paused: optIn && current === 0,
      };
    }),

  listMilestones: protectedProcedure
    .output(
      z.array(
        z.object({
          key: z.enum(MILESTONE_KEYS),
          label: z.string(),
          unlockedAt: z.date().nullable(),
        })
      )
    )
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const rows = await context.db
        .select()
        .from(userMilestones)
        .where(eq(userMilestones.userId, userId));
      const byKey = new Map(rows.map((row) => [row.key, row.unlockedAt]));
      return MILESTONE_KEYS.map((key) => ({
        key,
        label: MILESTONE_LABELS[key],
        unlockedAt: byKey.get(key) ?? null,
      }));
    }),

  setRhythmOptIn: protectedProcedure
    .input(z.object({ optIn: z.boolean() }))
    .output(z.object({ optIn: z.boolean() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await context.db
        .update(user)
        .set(
          input.optIn
            ? { rhythmOptIn: true }
            : { rhythmCurrent: 0, rhythmOptIn: false }
        )
        .where(eq(user.id, userId));
      return { optIn: input.optIn };
    }),

  weeklyIntentionality: protectedProcedure
    .input(z.object({ timeZone: timeZoneSchema }))
    .output(
      z.object({
        daysOverCapacity: z.number().int(),
        daysProtected: z.number().int(),
        q2Completed: z.number().int(),
        q3Completed: z.number().int(),
        weekEnd: z.string(),
        weekStart: z.string(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const today = localDateString(new Date(), input.timeZone);
      const weekStart = startOfWeekMonday(today);
      const weekEnd = addDays(weekStart, 6);

      const [sy, sm, sd] = weekStart.split("-").map(Number) as [
        number,
        number,
        number,
      ];
      const [ey, em, ed] = weekEnd.split("-").map(Number) as [
        number,
        number,
        number,
      ];
      const startMs = zonedLocalToUtcMs(sy, sm, sd, 0, 0, 0, 0, input.timeZone);
      const endMs = zonedLocalToUtcMs(
        ey,
        em,
        ed,
        23,
        59,
        59,
        999,
        input.timeZone
      );

      const completed = await context.db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.isCompleted, true),
            gte(tasks.completedAt, new Date(startMs)),
            lte(tasks.completedAt, new Date(endMs))
          )
        );

      let q2Completed = 0;
      let q3Completed = 0;
      for (const row of completed) {
        const q = getQuadrant(row.isUrgent, row.isImportant);
        if (q === "Q2") {
          q2Completed += 1;
        } else if (q === "Q3") {
          q3Completed += 1;
        }
      }

      const dayRows = await context.db
        .select()
        .from(userDayStats)
        .where(
          and(
            eq(userDayStats.userId, userId),
            gte(userDayStats.localDate, weekStart),
            lte(userDayStats.localDate, weekEnd)
          )
        );

      const prefs = await context.db
        .select({ dailyCapacityMinutes: user.dailyCapacityMinutes })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      const capacity = prefs[0]?.dailyCapacityMinutes ?? 300;

      let daysOverCapacity = 0;
      for (const row of dayRows) {
        if (row.plannedMinutes > capacity) {
          daysOverCapacity += 1;
        }
      }

      const daysProtected = await countProtectedDaysInRange({
        db: context.db,
        endDate: weekEnd,
        startDate: weekStart,
        userId,
      });

      return {
        daysOverCapacity,
        daysProtected,
        q2Completed,
        q3Completed,
        weekEnd,
        weekStart,
      };
    }),
};
