import { defineRelationsPart, sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { projects } from "./projects";

export const tasks = sqliteTable(
  "tasks",
  {
    actualMinutes: integer("actual_minutes").default(0).notNull(),
    blockedByTaskId: text("blocked_by_task_id").references(
      (): AnySQLiteColumn => tasks.id,
      { onDelete: "set null" }
    ),
    calendarEventId: text("calendar_event_id"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    dueDate: text("due_date"),
    dueTime: text("due_time"),
    estimatedMinutes: integer("estimated_minutes").default(30).notNull(),
    id: text("id").primaryKey(),
    isCompleted: integer("is_completed", { mode: "boolean" })
      .default(false)
      .notNull(),
    isImportant: integer("is_important").default(0).notNull(),
    isToday: integer("is_today", { mode: "boolean" }).default(false).notNull(),
    isUrgent: integer("is_urgent").default(0).notNull(),
    notes: text("notes"),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    recurrenceRule: text("recurrence_rule"),
    snoozeCount: integer("snooze_count").default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    status: text("status").default("active").notNull(),
    title: text("title").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id"),
  },
  (table) => [
    index("tasks_user_id_due_date_is_completed_idx").on(
      table.userId,
      table.dueDate,
      table.isCompleted
    ),
    index("tasks_user_id_is_urgent_is_important_idx").on(
      table.userId,
      table.isUrgent,
      table.isImportant
    ),
    index("tasks_user_id_is_today_sort_order_idx").on(
      table.userId,
      table.isToday,
      table.sortOrder
    ),
    index("tasks_user_id_status_idx").on(table.userId, table.status),
    index("tasks_user_id_project_id_idx").on(table.userId, table.projectId),
  ]
);

export const subtasks = sqliteTable(
  "subtasks",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    id: text("id").primaryKey(),
    isCompleted: integer("is_completed", { mode: "boolean" })
      .default(false)
      .notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
  },
  (table) => [
    index("subtasks_task_id_sort_order_idx").on(table.taskId, table.sortOrder),
  ]
);

export const productRelations = defineRelationsPart(
  { projects, subtasks, tasks, user },
  (r) => ({
    projects: {
      tasks: r.many.tasks({
        from: r.projects.id,
        to: r.tasks.projectId,
      }),
      user: r.one.user({
        from: r.projects.userId,
        to: r.user.id,
      }),
    },
    subtasks: {
      task: r.one.tasks({
        from: r.subtasks.taskId,
        to: r.tasks.id,
      }),
    },
    tasks: {
      blockedBy: r.one.tasks({
        alias: "task_blocked_by",
        from: r.tasks.blockedByTaskId,
        to: r.tasks.id,
      }),
      blockers: r.many.tasks({
        alias: "task_blocked_by",
        from: r.tasks.id,
        to: r.tasks.blockedByTaskId,
      }),
      project: r.one.projects({
        from: r.tasks.projectId,
        to: r.projects.id,
      }),
      subtasks: r.many.subtasks({
        from: r.tasks.id,
        to: r.subtasks.taskId,
      }),
      user: r.one.user({
        from: r.tasks.userId,
        to: r.user.id,
      }),
    },
    user: {
      projects: r.many.projects({
        from: r.user.id,
        to: r.projects.userId,
      }),
      tasks: r.many.tasks({
        from: r.user.id,
        to: r.tasks.userId,
      }),
    },
  })
);
