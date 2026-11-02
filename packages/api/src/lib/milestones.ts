import type { Database } from "@todo-task-app/db";
import { user } from "@todo-task-app/db/schema/auth";
import { userMilestones } from "@todo-task-app/db/schema/gamification";
import { tasks } from "@todo-task-app/db/schema/tasks";
import { and, eq, gte, lte } from "drizzle-orm";

import { getCapacityBucket } from "./capacity-bucket";
import { localDateString, zonedLocalToUtcMs } from "./completed-range";
import { getQuadrant } from "./quadrant";
import { countProtectedDaysInRange } from "./rhythm";

export const MILESTONE_KEYS = [
  "first_day_protected",
  "first_balanced_135",
  "first_week_q2_ge_q3",
  "protected_days_7",
  "protected_days_30",
] as const;

export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export const MILESTONE_LABELS: Record<MilestoneKey, string> = {
  first_balanced_135: "First balanced 1-3-5 Today",
  first_day_protected: "First day closed under capacity",
  first_week_q2_ge_q3: "First week with Q2 completions ≥ Q3",
  protected_days_7: "7 protected days",
  protected_days_30: "30 protected days",
};

async function unlockMilestone(
  db: Database,
  userId: string,
  key: MilestoneKey
): Promise<boolean> {
  const existing = await db
    .select({ key: userMilestones.key })
    .from(userMilestones)
    .where(and(eq(userMilestones.userId, userId), eq(userMilestones.key, key)))
    .limit(1);
  if (existing.length > 0) {
    return false;
  }
  await db.insert(userMilestones).values({ key, userId });
  return true;
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

export async function evaluateMilestones(options: {
  db: Database;
  timeZone: string;
  userId: string;
}): Promise<MilestoneKey[]> {
  const { db, userId, timeZone } = options;
  const unlocked: MilestoneKey[] = [];
  const now = new Date();
  const localDate = localDateString(now, timeZone);

  const userRows = await db
    .select({
      dailyCapacityMinutes: user.dailyCapacityMinutes,
      rhythmOptIn: user.rhythmOptIn,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const [prefs] = userRows;
  if (!prefs) {
    return unlocked;
  }

  const todayTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.isToday, true)));

  const openToday = todayTasks.filter((row) => !row.isCompleted);
  const stagedMinutes = todayTasks.reduce(
    (sum, row) => sum + row.estimatedMinutes,
    0
  );

  // Day protected: all staged Today tasks complete and under capacity.
  const stagedCount = todayTasks.length;
  const allStagedDone = stagedCount > 0 && openToday.length === 0;
  if (
    allStagedDone &&
    stagedMinutes <= prefs.dailyCapacityMinutes &&
    (await unlockMilestone(db, userId, "first_day_protected"))
  ) {
    unlocked.push("first_day_protected");
  }

  const majors = todayTasks.filter(
    (row) => getCapacityBucket(row.estimatedMinutes) === "major"
  );
  const mediums = todayTasks.filter(
    (row) => getCapacityBucket(row.estimatedMinutes) === "medium"
  );
  const quicks = todayTasks.filter(
    (row) => getCapacityBucket(row.estimatedMinutes) === "quick"
  );
  if (
    majors.length === 1 &&
    mediums.length === 3 &&
    quicks.length === 5 &&
    (await unlockMilestone(db, userId, "first_balanced_135"))
  ) {
    unlocked.push("first_balanced_135");
  }

  const weekStart = startOfWeekMonday(localDate);
  const weekEnd = addDays(weekStart, 6);
  const [wy, wm, wd] = weekStart.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [ey, em, ed] = weekEnd.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const weekStartMs = zonedLocalToUtcMs(wy, wm, wd, 0, 0, 0, 0, timeZone);
  const weekEndMs = zonedLocalToUtcMs(ey, em, ed, 23, 59, 59, 999, timeZone);
  const weekCompleted = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.isCompleted, true),
        gte(tasks.completedAt, new Date(weekStartMs)),
        lte(tasks.completedAt, new Date(weekEndMs))
      )
    );
  let q2 = 0;
  let q3 = 0;
  for (const row of weekCompleted) {
    const q = getQuadrant(row.isUrgent, row.isImportant);
    if (q === "Q2") {
      q2 += 1;
    } else if (q === "Q3") {
      q3 += 1;
    }
  }
  if (
    q2 >= q3 &&
    q2 > 0 &&
    (await unlockMilestone(db, userId, "first_week_q2_ge_q3"))
  ) {
    unlocked.push("first_week_q2_ge_q3");
  }

  if (prefs.rhythmOptIn) {
    const protectedCount = await countProtectedDaysInRange({
      db,
      endDate: localDate,
      startDate: "1970-01-01",
      userId,
    });
    if (
      protectedCount >= 7 &&
      (await unlockMilestone(db, userId, "protected_days_7"))
    ) {
      unlocked.push("protected_days_7");
    }
    if (
      protectedCount >= 30 &&
      (await unlockMilestone(db, userId, "protected_days_30"))
    ) {
      unlocked.push("protected_days_30");
    }
  }

  return unlocked;
}
