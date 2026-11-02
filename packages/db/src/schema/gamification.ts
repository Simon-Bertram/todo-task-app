import { defineRelationsPart, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const userDayStats = sqliteTable(
  "user_day_stats",
  {
    completedMinutes: integer("completed_minutes").default(0).notNull(),
    isProtected: integer("is_protected", { mode: "boolean" })
      .default(false)
      .notNull(),
    localDate: text("local_date").notNull(),
    plannedMinutes: integer("planned_minutes").default(0).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.localDate] })]
);

export const userMilestones = sqliteTable(
  "user_milestones",
  {
    key: text("key").notNull(),
    unlockedAt: integer("unlocked_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })]
);

export const gamificationRelations = defineRelationsPart(
  { user, userDayStats, userMilestones },
  (r) => ({
    user: {
      dayStats: r.many.userDayStats({
        from: r.user.id,
        to: r.userDayStats.userId,
      }),
      milestones: r.many.userMilestones({
        from: r.user.id,
        to: r.userMilestones.userId,
      }),
    },
    userDayStats: {
      user: r.one.user({
        from: r.userDayStats.userId,
        to: r.user.id,
      }),
    },
    userMilestones: {
      user: r.one.user({
        from: r.userMilestones.userId,
        to: r.user.id,
      }),
    },
  })
);
