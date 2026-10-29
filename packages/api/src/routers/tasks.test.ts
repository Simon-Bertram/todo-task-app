import { call } from "@orpc/server";
import { tasks } from "@todo-task-app/db/schema/tasks";
import { seedProject, seedUser } from "@todo-task-app/db/test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { Context } from "../context";
import {
  createAuthedContext,
  createTwoUserContext,
  createUnauthedContext,
} from "../test/fixtures";
import { tasksRouter } from "./tasks";

describe("tasksRouter", () => {
  describe("auth", () => {
    let unauthed: Context;

    beforeEach(async () => {
      unauthed = await createUnauthedContext();
    });

    it("rejects list without a session", async () => {
      await expect(
        call(tasksRouter.list, undefined, { context: unauthed })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects create without a session", async () => {
      await expect(
        call(tasksRouter.create, { title: "Nope" }, { context: unauthed })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects update without a session", async () => {
      await expect(
        call(
          tasksRouter.update,
          { id: "missing", title: "Nope" },
          { context: unauthed }
        )
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects delete without a session", async () => {
      await expect(
        call(tasksRouter.delete, { id: "missing" }, { context: unauthed })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  describe("create", () => {
    it("creates a task with defaults", async () => {
      const context = await createAuthedContext("user-1");
      const task = await call(
        tasksRouter.create,
        { title: "  Ship CRUD  " },
        { context }
      );

      expect(task).toMatchObject({
        dueDate: null,
        estimatedMinutes: 30,
        isCompleted: false,
        isImportant: 0,
        isToday: false,
        isUrgent: 0,
        notes: null,
        projectId: null,
        recurrenceRule: null,
        sortOrder: 0,
        title: "Ship CRUD",
      });
      expect(task.id).toBeTruthy();
    });

    it("persists optional fields", async () => {
      const context = await createAuthedContext("user-1", {
        project: { id: "proj-1", name: "Work" },
      });

      const task = await call(
        tasksRouter.create,
        {
          dueDate: "2026-10-28",
          estimatedMinutes: 45,
          isImportant: 3,
          isToday: true,
          isUrgent: 2,
          notes: "Details",
          projectId: "proj-1",
          recurrenceRule: "WEEKDAYS",
          title: "Deep work",
        },
        { context }
      );

      expect(task).toMatchObject({
        dueDate: "2026-10-28",
        estimatedMinutes: 45,
        isImportant: 3,
        isToday: true,
        isUrgent: 2,
        notes: "Details",
        projectId: "proj-1",
        recurrenceRule: "WEEKDAYS",
        title: "Deep work",
      });
    });

    it("rejects an empty title", async () => {
      const context = await createAuthedContext("user-1");
      await expect(
        call(tasksRouter.create, { title: "   " }, { context })
      ).rejects.toBeTruthy();
    });

    it("rejects invalid priority", async () => {
      const context = await createAuthedContext("user-1");
      await expect(
        call(tasksRouter.create, { isUrgent: 4, title: "Bad" }, { context })
      ).rejects.toBeTruthy();
    });

    it("rejects invalid estimatedMinutes", async () => {
      const context = await createAuthedContext("user-1");
      await expect(
        call(
          tasksRouter.create,
          { estimatedMinutes: 0, title: "Bad" },
          { context }
        )
      ).rejects.toBeTruthy();
      await expect(
        call(
          tasksRouter.create,
          { estimatedMinutes: 481, title: "Bad" },
          { context }
        )
      ).rejects.toBeTruthy();
    });

    it("rejects invalid dueDate", async () => {
      const context = await createAuthedContext("user-1");
      await expect(
        call(
          tasksRouter.create,
          { dueDate: "10/28/2026", title: "Bad" },
          { context }
        )
      ).rejects.toBeTruthy();
    });

    it("rejects a project owned by another user", async () => {
      const context = await createAuthedContext("user-1");
      await seedUser(context.db, { id: "user-2" });
      await seedProject(context.db, {
        id: "foreign-proj",
        userId: "user-2",
      });

      await expect(
        call(
          tasksRouter.create,
          { projectId: "foreign-proj", title: "Steal" },
          { context }
        )
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Project not found",
      });
    });

    it("rejects a missing projectId", async () => {
      const context = await createAuthedContext("user-1");
      await expect(
        call(
          tasksRouter.create,
          { projectId: "missing", title: "Orphan" },
          { context }
        )
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("list", () => {
    it("returns only the session user's incomplete tasks by default", async () => {
      const { userA, userB } = await createTwoUserContext();

      await call(tasksRouter.create, { title: "A1" }, { context: userA });
      const completed = await call(
        tasksRouter.create,
        { title: "A done" },
        { context: userA }
      );
      await call(
        tasksRouter.update,
        { id: completed.id, isCompleted: true },
        { context: userA }
      );
      await call(tasksRouter.create, { title: "B1" }, { context: userB });

      const listed = await call(tasksRouter.list, undefined, {
        context: userA,
      });

      expect(listed.map((task) => task.title)).toEqual(["A1"]);
    });

    it("includes completed tasks when requested", async () => {
      const context = await createAuthedContext("user-1");
      const open = await call(
        tasksRouter.create,
        { title: "Open" },
        { context }
      );
      const done = await call(
        tasksRouter.create,
        { title: "Done" },
        { context }
      );
      await call(
        tasksRouter.update,
        { id: done.id, isCompleted: true },
        { context }
      );

      const listed = await call(
        tasksRouter.list,
        { includeCompleted: true },
        { context }
      );

      expect(listed.map((task) => task.id).sort()).toEqual(
        [open.id, done.id].sort()
      );
    });

    it("orders by sortOrder then createdAt", async () => {
      const context = await createAuthedContext("user-1");
      const first = await call(
        tasksRouter.create,
        { title: "First" },
        { context }
      );
      const second = await call(
        tasksRouter.create,
        { title: "Second" },
        { context }
      );
      await call(
        tasksRouter.update,
        { id: second.id, sortOrder: 0 },
        { context }
      );
      await call(
        tasksRouter.update,
        { id: first.id, sortOrder: 1 },
        { context }
      );

      const listed = await call(tasksRouter.list, undefined, { context });
      expect(listed.map((task) => task.title)).toEqual(["Second", "First"]);
    });

    it("filters by projectId when provided", async () => {
      const context = await createAuthedContext("user-1", {
        project: { id: "proj-1", name: "Work" },
      });
      await seedProject(context.db, {
        id: "proj-2",
        name: "Home",
        userId: "user-1",
      });

      await call(
        tasksRouter.create,
        { projectId: "proj-1", title: "Work task" },
        { context }
      );
      await call(
        tasksRouter.create,
        { projectId: "proj-2", title: "Home task" },
        { context }
      );
      await call(tasksRouter.create, { title: "Inbox" }, { context });

      const work = await call(
        tasksRouter.list,
        { projectId: "proj-1" },
        { context }
      );
      expect(work.map((task) => task.title)).toEqual(["Work task"]);
    });

    it("filters unassigned tasks when projectId is null", async () => {
      const context = await createAuthedContext("user-1", {
        project: { id: "proj-1" },
      });
      await call(
        tasksRouter.create,
        { projectId: "proj-1", title: "Assigned" },
        { context }
      );
      await call(tasksRouter.create, { title: "Inbox" }, { context });

      const inbox = await call(
        tasksRouter.list,
        { projectId: null },
        { context }
      );
      expect(inbox.map((task) => task.title)).toEqual(["Inbox"]);
    });
  });

  describe("update", () => {
    it("patches fields and returns the updated task", async () => {
      const context = await createAuthedContext("user-1", {
        project: { id: "proj-1" },
      });
      const created = await call(
        tasksRouter.create,
        { title: "Draft" },
        { context }
      );

      const updated = await call(
        tasksRouter.update,
        {
          estimatedMinutes: 60,
          id: created.id,
          isImportant: 2,
          isToday: true,
          isUrgent: 3,
          notes: "Updated",
          projectId: "proj-1",
          recurrenceRule: "DAILY",
          title: "Ready",
        },
        { context }
      );

      expect(updated).toMatchObject({
        estimatedMinutes: 60,
        id: created.id,
        isImportant: 2,
        isToday: true,
        isUrgent: 3,
        notes: "Updated",
        projectId: "proj-1",
        recurrenceRule: "DAILY",
        title: "Ready",
      });
    });

    it("sets and clears completedAt when toggling isCompleted", async () => {
      const context = await createAuthedContext("user-1");
      const created = await call(
        tasksRouter.create,
        { title: "Toggle" },
        { context }
      );

      await call(
        tasksRouter.update,
        { id: created.id, isCompleted: true },
        { context }
      );

      const [completedRow] = await context.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, created.id));
      expect(completedRow?.isCompleted).toBe(true);
      expect(completedRow?.completedAt).toBeInstanceOf(Date);

      await call(
        tasksRouter.update,
        { id: created.id, isCompleted: false },
        { context }
      );

      const [reopenedRow] = await context.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, created.id));
      expect(reopenedRow?.isCompleted).toBe(false);
      expect(reopenedRow?.completedAt).toBeNull();
    });

    it("returns NOT_FOUND for another user's task", async () => {
      const { userA, userB } = await createTwoUserContext();
      const created = await call(
        tasksRouter.create,
        { title: "Private" },
        { context: userA }
      );

      await expect(
        call(
          tasksRouter.update,
          { id: created.id, title: "Hijack" },
          { context: userB }
        )
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("rejects a foreign projectId", async () => {
      const context = await createAuthedContext("user-1");
      await seedUser(context.db, { id: "user-2" });
      await seedProject(context.db, {
        id: "foreign-proj",
        userId: "user-2",
      });
      const created = await call(
        tasksRouter.create,
        { title: "Mine" },
        { context }
      );

      await expect(
        call(
          tasksRouter.update,
          { id: created.id, projectId: "foreign-proj" },
          { context }
        )
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("delete", () => {
    it("deletes an owned task", async () => {
      const context = await createAuthedContext("user-1");
      const created = await call(
        tasksRouter.create,
        { title: "Temp" },
        { context }
      );

      await expect(
        call(tasksRouter.delete, { id: created.id }, { context })
      ).resolves.toEqual({ id: created.id });

      const listed = await call(
        tasksRouter.list,
        { includeCompleted: true },
        { context }
      );
      expect(listed).toEqual([]);
    });

    it("returns NOT_FOUND for a missing id", async () => {
      const context = await createAuthedContext("user-1");
      await expect(
        call(tasksRouter.delete, { id: "missing" }, { context })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("returns NOT_FOUND when deleting another user's task", async () => {
      const { userA, userB } = await createTwoUserContext();
      const created = await call(
        tasksRouter.create,
        { title: "Keep" },
        { context: userA }
      );

      await expect(
        call(tasksRouter.delete, { id: created.id }, { context: userB })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      const listed = await call(tasksRouter.list, undefined, {
        context: userA,
      });
      expect(listed).toHaveLength(1);
    });
  });
});
