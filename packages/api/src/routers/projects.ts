import { ORPCError } from "@orpc/server";
import { projects } from "@todo-task-app/db/schema/projects";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = "#3b82f6";

const colorSchema = z.string().regex(HEX_COLOR, "Color must be #RRGGBB");

const projectOutputSchema = z.object({
  color: z.string(),
  id: z.string(),
  name: z.string(),
});

type ProjectRow = typeof projects.$inferSelect;

function toProjectOutput(row: ProjectRow) {
  return {
    color: row.color,
    id: row.id,
    name: row.name,
  };
}

export const projectsRouter = {
  create: protectedProcedure
    .input(
      z.object({
        color: colorSchema.optional(),
        name: z.string().trim().min(1).max(100),
      })
    )
    .output(projectOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const id = crypto.randomUUID();
      const [row] = await context.db
        .insert(projects)
        .values({
          color: input.color ?? DEFAULT_COLOR,
          id,
          name: input.name,
          userId,
        })
        .returning();

      if (!row) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Failed to create project",
        });
      }

      return toProjectOutput(row);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .output(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const deleted = await context.db
        .delete(projects)
        .where(and(eq(projects.id, input.id), eq(projects.userId, userId)))
        .returning({ id: projects.id });

      if (deleted.length === 0) {
        throw new ORPCError("NOT_FOUND", { message: "Project not found" });
      }

      return { id: input.id };
    }),

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

  update: protectedProcedure
    .input(
      z.object({
        color: colorSchema.optional(),
        id: z.string().min(1),
        name: z.string().trim().min(1).max(100).optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .output(projectOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { id, ...patch } = input;

      const updates: Partial<ProjectRow> = {};
      if (patch.name !== undefined) {
        updates.name = patch.name;
      }
      if (patch.color !== undefined) {
        updates.color = patch.color;
      }
      if (patch.sortOrder !== undefined) {
        updates.sortOrder = patch.sortOrder;
      }

      const [row] = await context.db
        .update(projects)
        .set(updates)
        .where(and(eq(projects.id, id), eq(projects.userId, userId)))
        .returning();

      if (!row) {
        throw new ORPCError("NOT_FOUND", { message: "Project not found" });
      }

      return toProjectOutput(row);
    }),
};
