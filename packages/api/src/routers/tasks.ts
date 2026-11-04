import { ORPCError } from "@orpc/server";
import type { Database } from "@todo-task-app/db";
import { projects } from "@todo-task-app/db/schema/projects";
import { tasks } from "@todo-task-app/db/schema/tasks";
import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { COMPLETED_RANGES, completedRangeBounds } from "../lib/completed-range";
import { evaluateMilestones } from "../lib/milestones";
import { nextDueDateForRecurrence } from "../lib/recurrence";
import { upsertDayStatsAndRhythm } from "../lib/rhythm";

const prioritySchema = z.number().int().min(0).max(3);
const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const estimatedMinutesSchema = z.number().int().min(1).max(480);
const progressPercentSchema = z.number().int().min(0).max(100);

const taskOutputSchema = z.object({
  completedAt: z.date().nullable(),
  dueDate: z.string().nullable(),
  estimatedMinutes: z.number().int(),
  id: z.string(),
  isCompleted: z.boolean(),
  isImportant: z.number().int(),
  isToday: z.boolean(),
  isUrgent: z.number().int(),
  notes: z.string().nullable(),
  progressPercent: z.number().int(),
  projectId: z.string().nullable(),
  recurrenceRule: z.string().nullable(),
  sortOrder: z.number().int(),
  title: z.string(),
});

type TaskRow = typeof tasks.$inferSelect;

function toTaskOutput(row: TaskRow) {
  return {
    completedAt: row.completedAt ?? null,
    dueDate: row.dueDate,
    estimatedMinutes: row.estimatedMinutes,
    id: row.id,
    isCompleted: row.isCompleted,
    isImportant: row.isImportant,
    isToday: row.isToday,
    isUrgent: row.isUrgent,
    notes: row.notes,
    progressPercent: row.progressPercent,
    projectId: row.projectId,
    recurrenceRule: row.recurrenceRule,
    sortOrder: row.sortOrder,
    title: row.title,
  };
}

const completedRangeSchema = z.enum(COMPLETED_RANGES);
const timeZoneSchema = z.string().min(1).max(100);

async function assertProjectOwned(
  db: Database,
  userId: string,
  projectId: string
): Promise<void> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (rows.length === 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Project not found",
    });
  }
}

interface TaskPatch {
  dueDate?: string | null;
  dueTime?: string | null;
  estimatedMinutes?: number;
  isCompleted?: boolean;
  isImportant?: number;
  isToday?: boolean;
  isUrgent?: number;
  notes?: string | null;
  progressPercent?: number;
  projectId?: string | null;
  recurrenceRule?: string | null;
  sortOrder?: number;
  title?: string;
}

function buildTaskUpdates(patch: TaskPatch): Partial<TaskRow> {
  const updates: Partial<TaskRow> = {};
  if (patch.title !== undefined) {
    updates.title = patch.title;
  }
  if (patch.notes !== undefined) {
    updates.notes = patch.notes;
  }
  if (patch.dueDate !== undefined) {
    updates.dueDate = patch.dueDate;
  }
  if (patch.dueTime !== undefined) {
    updates.dueTime = patch.dueTime;
  }
  if (patch.estimatedMinutes !== undefined) {
    updates.estimatedMinutes = patch.estimatedMinutes;
  }
  if (patch.progressPercent !== undefined) {
    updates.progressPercent = patch.progressPercent;
  }
  if (patch.isUrgent !== undefined) {
    updates.isUrgent = patch.isUrgent;
  }
  if (patch.isImportant !== undefined) {
    updates.isImportant = patch.isImportant;
  }
  if (patch.isToday !== undefined) {
    updates.isToday = patch.isToday;
  }
  if (patch.projectId !== undefined) {
    updates.projectId = patch.projectId;
  }
  if (patch.recurrenceRule !== undefined) {
    updates.recurrenceRule = patch.recurrenceRule;
  }
  if (patch.sortOrder !== undefined) {
    updates.sortOrder = patch.sortOrder;
  }
  if (patch.isCompleted !== undefined) {
    updates.isCompleted = patch.isCompleted;
    updates.completedAt = patch.isCompleted ? new Date() : null;
  }
  return updates;
}

async function spawnNextRecurrenceIfNeeded(
  db: Database,
  userId: string,
  current: TaskRow,
  patch: TaskPatch
): Promise<void> {
  const becameCompleted =
    patch.isCompleted === true && current.isCompleted === false;
  const recurrenceRule =
    patch.recurrenceRule === undefined
      ? current.recurrenceRule
      : patch.recurrenceRule;
  if (!(becameCompleted && recurrenceRule)) {
    return;
  }
  const nextDue = nextDueDateForRecurrence(
    recurrenceRule,
    patch.dueDate === undefined ? current.dueDate : patch.dueDate
  );
  if (!nextDue) {
    return;
  }
  await db.insert(tasks).values({
    dueDate: nextDue,
    dueTime: current.dueTime,
    estimatedMinutes: current.estimatedMinutes,
    id: crypto.randomUUID(),
    isImportant: current.isImportant,
    isToday: false,
    isUrgent: current.isUrgent,
    notes: current.notes,
    projectId: current.projectId,
    recurrenceRule,
    sortOrder: current.sortOrder,
    title: current.title,
    userId,
  });
}

export const tasksRouter = {
  create: protectedProcedure
    .input(
      z.object({
        dueDate: dueDateSchema.optional(),
        dueTime: z.string().nullable().optional(),
        estimatedMinutes: estimatedMinutesSchema.optional(),
        isImportant: prioritySchema.optional(),
        isToday: z.boolean().optional(),
        isUrgent: prioritySchema.optional(),
        notes: z.string().nullable().optional(),
        progressPercent: progressPercentSchema.optional(),
        projectId: z.string().nullable().optional(),
        recurrenceRule: z.string().nullable().optional(),
        title: z.string().trim().min(1).max(500),
      })
    )
    .output(taskOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const projectId = input.projectId ?? null;

      if (projectId) {
        await assertProjectOwned(context.db, userId, projectId);
      }

      const id = crypto.randomUUID();
      const [row] = await context.db
        .insert(tasks)
        .values({
          dueDate: input.dueDate ?? null,
          dueTime: input.dueTime ?? null,
          estimatedMinutes: input.estimatedMinutes ?? 30,
          id,
          isImportant: input.isImportant ?? 0,
          isToday: input.isToday ?? false,
          isUrgent: input.isUrgent ?? 0,
          notes: input.notes ?? null,
          progressPercent: input.progressPercent ?? 0,
          projectId,
          recurrenceRule: input.recurrenceRule ?? null,
          title: input.title,
          userId,
        })
        .returning();

      if (!row) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Failed to create task",
        });
      }

      return toTaskOutput(row);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .output(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const deleted = await context.db
        .delete(tasks)
        .where(and(eq(tasks.id, input.id), eq(tasks.userId, userId)))
        .returning({ id: tasks.id });

      if (deleted.length === 0) {
        throw new ORPCError("NOT_FOUND", { message: "Task not found" });
      }

      return { id: input.id };
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          includeCompleted: z.boolean().optional(),
          // undefined = all; null = unassigned; string = that project
          projectId: z.string().nullable().optional(),
        })
        .optional()
    )
    .output(z.array(taskOutputSchema))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const includeCompleted = input?.includeCompleted ?? false;

      const conditions = [eq(tasks.userId, userId)];
      if (!includeCompleted) {
        conditions.push(eq(tasks.isCompleted, false));
      }
      if (input?.projectId === null) {
        conditions.push(isNull(tasks.projectId));
      } else if (typeof input?.projectId === "string") {
        conditions.push(eq(tasks.projectId, input.projectId));
      }

      const rows = await context.db
        .select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));

      return rows.map(toTaskOutput);
    }),

  listCompleted: protectedProcedure
    .input(
      z.object({
        range: completedRangeSchema.default("this_week"),
        timeZone: timeZoneSchema,
      })
    )
    .output(z.array(taskOutputSchema))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      let bounds: ReturnType<typeof completedRangeBounds>;
      try {
        bounds = completedRangeBounds(input.range, input.timeZone);
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          cause: error,
          message: "Invalid time zone",
        });
      }

      const conditions = [
        eq(tasks.userId, userId),
        eq(tasks.isCompleted, true),
      ];
      if (bounds.startMs !== null) {
        conditions.push(gte(tasks.completedAt, new Date(bounds.startMs)));
      }
      if (bounds.endMs !== null) {
        conditions.push(lte(tasks.completedAt, new Date(bounds.endMs)));
      }

      const rows = await context.db
        .select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(desc(tasks.completedAt), asc(tasks.title));

      return rows.map(toTaskOutput);
    }),

  update: protectedProcedure
    .input(
      z.object({
        dueDate: dueDateSchema.optional(),
        dueTime: z.string().nullable().optional(),
        estimatedMinutes: estimatedMinutesSchema.optional(),
        id: z.string().min(1),
        isCompleted: z.boolean().optional(),
        isImportant: prioritySchema.optional(),
        isToday: z.boolean().optional(),
        isUrgent: prioritySchema.optional(),
        notes: z.string().nullable().optional(),
        progressPercent: progressPercentSchema.optional(),
        projectId: z.string().nullable().optional(),
        recurrenceRule: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
        timeZone: timeZoneSchema.optional(),
        title: z.string().trim().min(1).max(500).optional(),
      })
    )
    .output(
      taskOutputSchema.extend({
        unlockedMilestones: z.array(z.string()).optional(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { id, timeZone, ...patch } = input;

      if (patch.projectId) {
        await assertProjectOwned(context.db, userId, patch.projectId);
      }

      const updates = buildTaskUpdates(patch);

      const existing = await context.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
        .limit(1);

      const [current] = existing;
      if (!current) {
        throw new ORPCError("NOT_FOUND", { message: "Task not found" });
      }

      const [row] = await context.db
        .update(tasks)
        .set(updates)
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
        .returning();

      if (!row) {
        throw new ORPCError("NOT_FOUND", { message: "Task not found" });
      }

      await spawnNextRecurrenceIfNeeded(context.db, userId, current, patch);

      let unlockedMilestones: string[] | undefined;
      const zone = timeZone ?? "UTC";
      const shouldRollup =
        patch.isCompleted !== undefined || patch.isToday !== undefined;
      if (shouldRollup) {
        try {
          await upsertDayStatsAndRhythm({
            db: context.db,
            timeZone: zone,
            userId,
          });
          unlockedMilestones = await evaluateMilestones({
            db: context.db,
            timeZone: zone,
            userId,
          });
        } catch {
          // Prefer mutation success over gamification rollup failures.
        }
      }

      return {
        ...toTaskOutput(row),
        unlockedMilestones,
      };
    }),
};
