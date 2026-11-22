import { ORPCError } from "@orpc/server";
import type { Database } from "@todo-task-app/db";
import { subtasks, tasks } from "@todo-task-app/db/schema/tasks";
import { and, asc, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const subtaskOutputSchema = z.object({
  id: z.string(),
  isCompleted: z.boolean(),
  sortOrder: z.number().int(),
  taskId: z.string(),
  title: z.string(),
});

type SubtaskRow = typeof subtasks.$inferSelect;

function toSubtaskOutput(row: SubtaskRow) {
  return {
    id: row.id,
    isCompleted: row.isCompleted,
    sortOrder: row.sortOrder,
    taskId: row.taskId,
    title: row.title,
  };
}

async function assertOwnedTask(
  db: Database,
  userId: string,
  taskId: string
): Promise<typeof tasks.$inferSelect> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  const [task] = rows;
  if (!task) {
    throw new ORPCError("NOT_FOUND", { message: "Task not found" });
  }
  return task;
}

async function getOwnedSubtask(
  db: Database,
  userId: string,
  subtaskId: string
): Promise<{ parent: typeof tasks.$inferSelect; subtask: SubtaskRow }> {
  const rows = await db
    .select({
      parent: tasks,
      subtask: subtasks,
    })
    .from(subtasks)
    .innerJoin(tasks, eq(subtasks.taskId, tasks.id))
    .where(and(eq(subtasks.id, subtaskId), eq(tasks.userId, userId)))
    .limit(1);

  const [row] = rows;
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Subtask not found" });
  }
  return row;
}

export const subtasksRouter = {
  create: protectedProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        title: z.string().trim().min(1).max(500),
      })
    )
    .output(subtaskOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await assertOwnedTask(context.db, userId, input.taskId);

      const [agg] = await context.db
        .select({ maxSort: max(subtasks.sortOrder) })
        .from(subtasks)
        .where(eq(subtasks.taskId, input.taskId));

      const nextSort =
        agg?.maxSort === null || agg?.maxSort === undefined
          ? 0
          : agg.maxSort + 1;

      const id = crypto.randomUUID();
      const [row] = await context.db
        .insert(subtasks)
        .values({
          id,
          sortOrder: nextSort,
          taskId: input.taskId,
          title: input.title,
        })
        .returning();

      if (!row) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Failed to create subtask",
        });
      }

      return toSubtaskOutput(row);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .output(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await getOwnedSubtask(context.db, userId, input.id);

      await context.db.delete(subtasks).where(eq(subtasks.id, input.id));

      return { id: input.id };
    }),

  list: protectedProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .output(z.array(subtaskOutputSchema))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await assertOwnedTask(context.db, userId, input.taskId);

      const rows = await context.db
        .select()
        .from(subtasks)
        .where(eq(subtasks.taskId, input.taskId))
        .orderBy(asc(subtasks.sortOrder), asc(subtasks.createdAt));

      return rows.map(toSubtaskOutput);
    }),

  listByTaskIds: protectedProcedure
    .input(
      z.object({
        taskIds: z.array(z.string().min(1)).max(500),
      })
    )
    .output(z.array(subtaskOutputSchema))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      if (input.taskIds.length === 0) {
        return [];
      }

      const owned = await context.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), inArray(tasks.id, input.taskIds)));
      const ownedIds = owned.map((row) => row.id);
      if (ownedIds.length === 0) {
        return [];
      }

      const rows = await context.db
        .select()
        .from(subtasks)
        .where(inArray(subtasks.taskId, ownedIds))
        .orderBy(
          asc(subtasks.taskId),
          asc(subtasks.sortOrder),
          asc(subtasks.createdAt)
        );

      return rows.map(toSubtaskOutput);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        isCompleted: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        title: z.string().trim().min(1).max(500).optional(),
      })
    )
    .output(subtaskOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { id, ...patch } = input;
      const { parent, subtask } = await getOwnedSubtask(context.db, userId, id);

      const updates: Partial<SubtaskRow> = {};
      if (patch.title !== undefined) {
        updates.title = patch.title;
      }
      if (patch.isCompleted !== undefined) {
        updates.isCompleted = patch.isCompleted;
      }
      if (patch.sortOrder !== undefined) {
        updates.sortOrder = patch.sortOrder;
      }

      if (Object.keys(updates).length === 0) {
        return toSubtaskOutput(subtask);
      }

      const [row] = await context.db
        .update(subtasks)
        .set(updates)
        .where(eq(subtasks.id, id))
        .returning();

      if (!row) {
        throw new ORPCError("NOT_FOUND", { message: "Subtask not found" });
      }

      const reopened =
        patch.isCompleted === false && subtask.isCompleted === true;
      if (reopened && parent.isCompleted) {
        await context.db
          .update(tasks)
          .set({ completedAt: null, isCompleted: false })
          .where(and(eq(tasks.id, parent.id), eq(tasks.userId, userId)));
      }

      return toSubtaskOutput(row);
    }),
};

/** Aggregate subtask counts for a set of task ids (caller must own the tasks). */
export async function loadSubtaskCounts(
  db: Database,
  taskIds: string[]
): Promise<Map<string, { completed: number; total: number }>> {
  const counts = new Map<string, { completed: number; total: number }>();
  for (const taskId of taskIds) {
    counts.set(taskId, { completed: 0, total: 0 });
  }
  if (taskIds.length === 0) {
    return counts;
  }

  const rows = await db
    .select({
      isCompleted: subtasks.isCompleted,
      taskId: subtasks.taskId,
    })
    .from(subtasks)
    .where(inArray(subtasks.taskId, taskIds));

  for (const row of rows) {
    const entry = counts.get(row.taskId) ?? { completed: 0, total: 0 };
    entry.total += 1;
    if (row.isCompleted) {
      entry.completed += 1;
    }
    counts.set(row.taskId, entry);
  }

  return counts;
}

export async function countOpenSubtasks(
  db: Database,
  taskId: string
): Promise<number> {
  const rows = await db
    .select({ id: subtasks.id })
    .from(subtasks)
    .where(and(eq(subtasks.taskId, taskId), eq(subtasks.isCompleted, false)));
  return rows.length;
}
