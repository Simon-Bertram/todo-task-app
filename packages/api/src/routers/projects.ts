import { projects } from "@todo-task-app/db/schema/projects";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const projectOutputSchema = z.object({
  color: z.string(),
  id: z.string(),
  name: z.string(),
});

export const projectsRouter = {
  list: protectedProcedure
    .output(z.array(projectOutputSchema))
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const rows = await context.db
        .select({
          color: projects.color,
          id: projects.id,
          name: projects.name,
        })
        .from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(asc(projects.sortOrder), asc(projects.createdAt));

      return rows;
    }),
};
