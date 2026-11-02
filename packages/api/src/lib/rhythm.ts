import type { Database } from "@todo-task-app/db";
import { user } from "@todo-task-app/db/schema/auth";
import { userDayStats } from "@todo-task-app/db/schema/gamification";
import { tasks } from "@todo-task-app/db/schema/tasks";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import { localDateString, zonedLocalToUtcMs } from "./completed-range";

function addCalendarDays(localDate: string, delta: number): string {
  const [year, month, day] = localDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const next = new Date(Date.UTC(year, month - 1, day + delta));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function upsertDayStatsAndRhythm(options: {
  db: Database;
  timeZone: string;
  userId: string;
}): Promise<void> {
  const { db, userId, timeZone } = options;
  const now = new Date();
  const localDate = localDateString(now, timeZone);
  const [year, month, day] = localDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const startMs = zonedLocalToUtcMs(year, month, day, 0, 0, 0, 0, timeZone);
  const endMs = zonedLocalToUtcMs(year, month, day, 23, 59, 59, 999, timeZone);

  const todayRows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.isToday, true)));

  const openToday = todayRows.filter((row) => !row.isCompleted);
  const plannedMinutes = openToday.reduce(
    (sum, row) => sum + row.estimatedMinutes,
    0
  );

  const completedToday = await db
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

  const completedMinutes = completedToday.reduce(
    (sum, row) => sum + row.estimatedMinutes,
    0
  );

  const userRows = await db
    .select({
      dailyCapacityMinutes: user.dailyCapacityMinutes,
      rhythmBest: user.rhythmBest,
      rhythmCurrent: user.rhythmCurrent,
      rhythmOptIn: user.rhythmOptIn,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const [prefs] = userRows;
  if (!prefs) {
    return;
  }

  const capacity = prefs.dailyCapacityMinutes;
  const isProtected = completedToday.length >= 1 && plannedMinutes <= capacity;

  await db
    .insert(userDayStats)
    .values({
      completedMinutes,
      isProtected,
      localDate,
      plannedMinutes,
      userId,
    })
    .onConflictDoUpdate({
      set: {
        completedMinutes,
        isProtected,
        plannedMinutes,
        updatedAt: new Date(),
      },
      target: [userDayStats.userId, userDayStats.localDate],
    });

  if (!prefs.rhythmOptIn) {
    return;
  }

  let current = 0;
  if (isProtected) {
    const history = await db
      .select({
        isProtected: userDayStats.isProtected,
        localDate: userDayStats.localDate,
      })
      .from(userDayStats)
      .where(eq(userDayStats.userId, userId))
      .orderBy(desc(userDayStats.localDate))
      .limit(400);
    const byDate = new Map(
      history.map((row) => [row.localDate, row.isProtected])
    );
    let cursor = localDate;
    for (let i = 0; i < 400; i += 1) {
      if (!byDate.get(cursor)) {
        break;
      }
      current += 1;
      cursor = addCalendarDays(cursor, -1);
    }
  }

  const best = Math.max(prefs.rhythmBest, current);
  await db
    .update(user)
    .set({ rhythmBest: best, rhythmCurrent: current })
    .where(eq(user.id, userId));
}

export async function countProtectedDaysInRange(options: {
  db: Database;
  endDate: string;
  startDate: string;
  userId: string;
}): Promise<number> {
  const rows = await options.db
    .select()
    .from(userDayStats)
    .where(
      and(
        eq(userDayStats.userId, options.userId),
        eq(userDayStats.isProtected, true),
        gte(userDayStats.localDate, options.startDate),
        lte(userDayStats.localDate, options.endDate)
      )
    )
    .orderBy(desc(userDayStats.localDate));
  return rows.length;
}
