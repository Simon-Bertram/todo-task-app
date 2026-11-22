import { call } from "@orpc/server";
import { tasks } from "@todo-task-app/db/schema/tasks";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { Context } from "../context";
import {
  createAuthedContext,
  createTwoUserContext,
  createUnauthedContext,
} from "../test/fixtures";
import { subtasksRouter } from "./subtasks";
import { tasksRouter } from "./tasks";

describe("subtasksRouter", () => {
  describe("auth", () => {
    let unauthed: Context;

    beforeEach(async () => {
      unauthed = await createUnauthedContext();
    });

    it("rejects list without a session", async () => {
      await expect(
        call(subtasksRouter.list, { taskId: "x" }, { context: unauthed })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects create without a session", async () => {
      await expect(
        call(
          subtasksRouter.create,
          { taskId: "x", title: "Nope" },
          { context: unauthed }
        )
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  describe("CRUD", () => {
    it("creates, lists, updates, and deletes subtasks for an owned task", async () => {
      const context = await createAuthedContext("user-1");
      const task = await call(
        tasksRouter.create,
        { title: "Parent" },
        { context }
      );

      const first = await call(
        subtasksRouter.create,
        { taskId: task.id, title: "  Step one  " },
        { context }
      );
      const second = await call(
        subtasksRouter.create,
        { taskId: task.id, title: "Step two" },
        { context }
      );

      expect(first).toMatchObject({
        isCompleted: false,
        sortOrder: 0,
        taskId: task.id,
        title: "Step one",
      });
      expect(second.sortOrder).toBe(1);

      const listed = await call(
        subtasksRouter.list,
        { taskId: task.id },
        { context }
      );
      expect(listed.map((row) => row.title)).toEqual(["Step one", "Step two"]);

      const updated = await call(
        subtasksRouter.update,
        { id: first.id, isCompleted: true, title: "Step 1 done" },
        { context }
      );
      expect(updated).toMatchObject({
        isCompleted: true,
        title: "Step 1 done",
      });

      await call(subtasksRouter.delete, { id: second.id }, { context });
      const afterDelete = await call(
        subtasksRouter.list,
        { taskId: task.id },
        { context }
      );
      expect(afterDelete.map((row) => row.id)).toEqual([first.id]);
    });

    it("reorders via sortOrder updates", async () => {
      const context = await createAuthedContext("user-1");
      const task = await call(
        tasksRouter.create,
        { title: "Parent" },
        { context }
      );
      const a = await call(
        subtasksRouter.create,
        { taskId: task.id, title: "A" },
        { context }
      );
      const b = await call(
        subtasksRouter.create,
        { taskId: task.id, title: "B" },
        { context }
      );

      await call(
        subtasksRouter.update,
        { id: a.id, sortOrder: 1 },
        { context }
      );
      await call(
        subtasksRouter.update,
        { id: b.id, sortOrder: 0 },
        { context }
      );

      const listed = await call(
        subtasksRouter.list,
        { taskId: task.id },
        { context }
      );
      expect(listed.map((row) => row.title)).toEqual(["B", "A"]);
    });

    it("rejects foreign task access", async () => {
      const { userA, userB } = await createTwoUserContext();
      const task = await call(
        tasksRouter.create,
        { title: "A only" },
        { context: userA }
      );

      await expect(
        call(
          subtasksRouter.create,
          { taskId: task.id, title: "Steal" },
          { context: userB }
        )
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      await expect(
        call(subtasksRouter.list, { taskId: task.id }, { context: userB })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("listByTaskIds returns only owned tasks' subtasks", async () => {
      const { userA, userB } = await createTwoUserContext();
      const taskA = await call(
        tasksRouter.create,
        { title: "A" },
        { context: userA }
      );
      const taskB = await call(
        tasksRouter.create,
        { title: "B" },
        { context: userB }
      );
      await call(
        subtasksRouter.create,
        { taskId: taskA.id, title: "A1" },
        { context: userA }
      );
      await call(
        subtasksRouter.create,
        { taskId: taskB.id, title: "B1" },
        { context: userB }
      );

      const listed = await call(
        subtasksRouter.listByTaskIds,
        { taskIds: [taskA.id, taskB.id] },
        { context: userA }
      );
      expect(listed.map((row) => row.title)).toEqual(["A1"]);
    });
  });

  describe("parent completion invariant", () => {
    it("auto-reopens parent when a completed subtask is reopened", async () => {
      const context = await createAuthedContext("user-1");
      const task = await call(
        tasksRouter.create,
        { title: "Parent" },
        { context }
      );
      const sub = await call(
        subtasksRouter.create,
        { taskId: task.id, title: "Only" },
        { context }
      );
      await call(
        subtasksRouter.update,
        { id: sub.id, isCompleted: true },
        { context }
      );
      await call(
        tasksRouter.update,
        { id: task.id, isCompleted: true },
        { context }
      );

      await call(
        subtasksRouter.update,
        { id: sub.id, isCompleted: false },
        { context }
      );

      const [parent] = await context.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
        .limit(1);
      expect(parent?.isCompleted).toBe(false);
      expect(parent?.completedAt).toBeNull();
    });
  });
});

describe("tasksRouter completion guard with subtasks", () => {
  it("rejects completing a task with open subtasks", async () => {
    const context = await createAuthedContext("user-1");
    const task = await call(
      tasksRouter.create,
      { title: "Parent" },
      { context }
    );
    await call(
      subtasksRouter.create,
      { taskId: task.id, title: "Open" },
      { context }
    );

    await expect(
      call(tasksRouter.update, { id: task.id, isCompleted: true }, { context })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows complete when all subtasks are done", async () => {
    const context = await createAuthedContext("user-1");
    const task = await call(
      tasksRouter.create,
      { title: "Parent" },
      { context }
    );
    const sub = await call(
      subtasksRouter.create,
      { taskId: task.id, title: "Done" },
      { context }
    );
    await call(
      subtasksRouter.update,
      { id: sub.id, isCompleted: true },
      { context }
    );

    const updated = await call(
      tasksRouter.update,
      { id: task.id, isCompleted: true },
      { context }
    );
    expect(updated.isCompleted).toBe(true);
    expect(updated.subtaskCount).toBe(1);
    expect(updated.subtaskCompletedCount).toBe(1);
  });

  it("allows complete after open subtasks are removed", async () => {
    const context = await createAuthedContext("user-1");
    const task = await call(
      tasksRouter.create,
      { title: "Parent" },
      { context }
    );
    const sub = await call(
      subtasksRouter.create,
      { taskId: task.id, title: "Temp" },
      { context }
    );
    await call(subtasksRouter.delete, { id: sub.id }, { context });

    const updated = await call(
      tasksRouter.update,
      { id: task.id, isCompleted: true },
      { context }
    );
    expect(updated.isCompleted).toBe(true);
    expect(updated.subtaskCount).toBe(0);
  });

  it("list includes subtask counts", async () => {
    const context = await createAuthedContext("user-1");
    const task = await call(
      tasksRouter.create,
      { title: "Parent" },
      { context }
    );
    const a = await call(
      subtasksRouter.create,
      { taskId: task.id, title: "A" },
      { context }
    );
    await call(
      subtasksRouter.create,
      { taskId: task.id, title: "B" },
      { context }
    );
    await call(
      subtasksRouter.update,
      { id: a.id, isCompleted: true },
      { context }
    );

    const listed = await call(tasksRouter.list, undefined, { context });
    expect(listed[0]).toMatchObject({
      id: task.id,
      subtaskCompletedCount: 1,
      subtaskCount: 2,
    });
  });
});
