import { user } from "@todo-task-app/db/schema/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
  parseTasksBoardPrefs,
  tasksBoardPrefsSchema,
} from "../schemas/tasks-board-prefs";

const preferencesOutputSchema = z.object({
  tasksBoard: tasksBoardPrefsSchema,
});

export const preferencesRouter = {
  get: protectedProcedure
    .output(preferencesOutputSchema)
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const rows = await context.db
        .select({ tasksBoardPrefs: user.tasksBoardPrefs })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const raw = rows[0]?.tasksBoardPrefs ?? null;
      return {
        tasksBoard: parseTasksBoardPrefs(raw),
      };
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
