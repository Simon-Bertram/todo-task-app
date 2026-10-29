import { call } from "@orpc/server";
import { projects } from "@todo-task-app/db/schema/projects";
import { seedProject, seedUser } from "@todo-task-app/db/test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { Context } from "../context";
import {
  createAuthedContext,
  createTwoUserContext,
  createUnauthedContext,
} from "../test/fixtures";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";

describe("projectsRouter", () => {
  describe("auth", () => {
    let unauthed: Context;

    beforeEach(async () => {
      unauthed = await createUnauthedContext();
    });

    it("rejects list without a session", async () => {
      await expect(
        call(projectsRouter.list, undefined, { context: unauthed })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects create without a session", async () => {
      await expect(
        call(projectsRouter.create, { name: "Nope" }, { context: unauthed })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects update without a session", async () => {
      await expect(
        call(
          projectsRouter.update,
          { id: "missing", name: "Nope" },
          { context: unauthed }
        )
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects delete without a session", async () => {
      await expect(
        call(projectsRouter.delete, { id: "missing" }, { context: unauthed })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  describe("create", () => {
    it("creates a project with default color", async () => {
      const context = await createAuthedContext("user-1");
      const project = await call(
        projectsRouter.create,
        { name: "  Work  " },
        { context }
      );

      expect(project).toMatchObject({
        color: "#3b82f6",
        name: "Work",
      });
      expect(project.id).toBeTruthy();
    });

    it("persists a custom hex color", async () => {
      const context = await createAuthedContext("user-1");
      const project = await call(
        projectsRouter.create,
        { color: "#ef4444", name: "Urgent" },
        { context }
      );

      expect(project).toMatchObject({
        color: "#ef4444",
        name: "Urgent",
      });
    });

    it("rejects an empty name", async () => {
      const context = await createAuthedContext("user-1");
      await expect(
        call(projectsRouter.create, { name: "   " }, { context })
      ).rejects.toBeTruthy();
    });

    it("rejects an invalid color", async () => {
      const context = await createAuthedContext("user-1");
      await expect(
        call(projectsRouter.create, { color: "blue", name: "Bad" }, { context })
      ).rejects.toBeTruthy();
    });
  });

  describe("list", () => {
    it("returns only the session user's projects", async () => {
      const { userA, userB } = await createTwoUserContext();

      await call(projectsRouter.create, { name: "Alpha" }, { context: userA });
      await call(projectsRouter.create, { name: "Beta" }, { context: userB });

      const listed = await call(projectsRouter.list, undefined, {
        context: userA,
      });

      expect(listed.map((project) => project.name)).toEqual(["Alpha"]);
    });

    it("orders by sortOrder then createdAt", async () => {
      const context = await createAuthedContext("user-1");
      const first = await call(
        projectsRouter.create,
        { name: "First" },
        { context }
      );
      const second = await call(
        projectsRouter.create,
        { name: "Second" },
        { context }
      );
      await call(
        projectsRouter.update,
        { id: second.id, sortOrder: 0 },
        { context }
      );
      await call(
        projectsRouter.update,
        { id: first.id, sortOrder: 1 },
        { context }
      );

      const listed = await call(projectsRouter.list, undefined, { context });
      expect(listed.map((project) => project.name)).toEqual([
        "Second",
        "First",
      ]);
    });
  });

  describe("update", () => {
    it("patches name and color", async () => {
      const context = await createAuthedContext("user-1");
      const created = await call(
        projectsRouter.create,
        { name: "Draft" },
        { context }
      );

      const updated = await call(
        projectsRouter.update,
        { color: "#22c55e", id: created.id, name: "Shipped" },
        { context }
      );

      expect(updated).toMatchObject({
        color: "#22c55e",
        id: created.id,
        name: "Shipped",
      });
    });

    it("returns NOT_FOUND for another user's project", async () => {
      const { userA, userB } = await createTwoUserContext();
      const created = await call(
        projectsRouter.create,
        { name: "Private" },
        { context: userA }
      );

      await expect(
        call(
          projectsRouter.update,
          { id: created.id, name: "Stolen" },
          { context: userB }
        )
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("delete", () => {
    it("deletes an owned project and unassigns tasks", async () => {
      const context = await createAuthedContext("user-1");
      const project = await call(
        projectsRouter.create,
        { name: "Temp" },
        { context }
      );
      const task = await call(
        tasksRouter.create,
        { projectId: project.id, title: "Linked" },
        { context }
      );

      const deleted = await call(
        projectsRouter.delete,
        { id: project.id },
        { context }
      );
      expect(deleted).toEqual({ id: project.id });

      const remaining = await context.db
        .select()
        .from(projects)
        .where(eq(projects.id, project.id));
      expect(remaining).toHaveLength(0);

      const listed = await call(
        tasksRouter.list,
        { includeCompleted: true },
        { context }
      );
      expect(listed.find((row) => row.id === task.id)?.projectId).toBeNull();
    });

    it("returns NOT_FOUND for another user's project", async () => {
      const { userA, userB } = await createTwoUserContext();
      const created = await call(
        projectsRouter.create,
        { name: "Keep" },
        { context: userA }
      );

      await expect(
        call(projectsRouter.delete, { id: created.id }, { context: userB })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("returns NOT_FOUND for a missing id", async () => {
      const context = await createAuthedContext("user-1");
      await expect(
        call(projectsRouter.delete, { id: "missing" }, { context })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("isolation", () => {
    it("cannot list a seeded project owned by another user", async () => {
      const context = await createAuthedContext("user-1");
      await seedUser(context.db, { id: "user-2" });
      await seedProject(context.db, {
        id: "foreign",
        name: "Foreign",
        userId: "user-2",
      });

      const listed = await call(projectsRouter.list, undefined, { context });
      expect(listed).toEqual([]);
    });
  });
});
