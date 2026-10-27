import { ORPCError } from "@orpc/server";
import type { Database } from "@todo-task-app/db";
import { projects } from "@todo-task-app/db/schema/projects";
import { tasks } from "@todo-task-app/db/schema/tasks";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const prioritySchema = z.number().int().min(0).max(3);
const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const estimatedMinutesSchema = z.number().int().min(1).max(480);

const taskOutputSchema = z.object({
  dueDate: z.string().nullable(),
  estimatedMinutes: z.number().int(),
  id: z.string(),
  isCompleted: z.boolean(),
  isImportant: z.number().int(),
  isToday: z.boolean(),
  isUrgent: z.number().int(),
  notes: z.string().nullable(),
  projectId: z.string().nullable(),
  recurrenceRule: z.string().nullable(),
  sortOrder: z.number().int(),
  title: z.string(),
});

type TaskRow = typeof tasks.$inferSelect;

function toTaskOutput(row: TaskRow) {
  return {
    dueDate: row.dueDate,
    estimatedMinutes: row.estimatedMinutes,
    id: row.id,
    isCompleted: row.isCompleted,
    isImportant: row.isImportant,
    isToday: row.isToday,
    isUrgent: row.isUrgent,
    notes: row.notes,
    projectId: row.projectId,
    recurrenceRule: row.recurrenceRule,
    sortOrder: row.sortOrder,
    title: row.title,
  };
}

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

      const rows = await context.db
        .select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));

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
        projectId: z.string().nullable().optional(),
        recurrenceRule: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
        title: z.string().trim().min(1).max(500).optional(),
      })
    )
    .output(taskOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { id, ...patch } = input;

      if (patch.projectId) {
        await assertProjectOwned(context.db, userId, patch.projectId);
      }

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

      const [row] = await context.db
        .update(tasks)
        .set(updates)
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
        .returning();

      if (!row) {
        throw new ORPCError("NOT_FOUND", { message: "Task not found" });
      }

      return toTaskOutput(row);
    }),
};
