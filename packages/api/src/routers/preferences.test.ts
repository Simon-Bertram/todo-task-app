import { call } from "@orpc/server";
import { user } from "@todo-task-app/db/schema/auth";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { Context } from "../context";
import { DEFAULT_TASKS_BOARD_PREFS } from "../schemas/tasks-board-prefs";
import { createAuthedContext, createUnauthedContext } from "../test/fixtures";
import { preferencesRouter } from "./preferences";

describe("preferencesRouter", () => {
  describe("auth", () => {
    let unauthed: Context;

    beforeEach(async () => {
      unauthed = await createUnauthedContext();
    });

    it("rejects get without a session", async () => {
      await expect(
        call(preferencesRouter.get, undefined, { context: unauthed })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects updateTasksBoard without a session", async () => {
      await expect(
        call(preferencesRouter.updateTasksBoard, DEFAULT_TASKS_BOARD_PREFS, {
          context: unauthed,
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  describe("get", () => {
    it("returns defaults when no prefs are stored", async () => {
      const context = await createAuthedContext("user-1");
      const result = await call(preferencesRouter.get, undefined, {
        context,
      });

      expect(result.tasksBoard).toEqual(DEFAULT_TASKS_BOARD_PREFS);
    });

    it("returns stored prefs when valid JSON is present", async () => {
      const context = await createAuthedContext("user-1");
      const stored = {
        due: "today" as const,
        importanceMin: 2 as const,
        project: "inbox",
        sort: "title" as const,
        urgencyMin: 1 as const,
      };

      await context.db
        .update(user)
        .set({ tasksBoardPrefs: JSON.stringify(stored) })
        .where(eq(user.id, "user-1"));

      const result = await call(preferencesRouter.get, undefined, {
        context,
      });

      expect(result.tasksBoard).toEqual(stored);
    });

    it("falls back to defaults for invalid JSON", async () => {
      const context = await createAuthedContext("user-1");
      await context.db
        .update(user)
        .set({ tasksBoardPrefs: "{not-json" })
        .where(eq(user.id, "user-1"));

      const result = await call(preferencesRouter.get, undefined, {
        context,
      });

      expect(result.tasksBoard).toEqual(DEFAULT_TASKS_BOARD_PREFS);
    });
  });

  describe("updateTasksBoard", () => {
    it("persists prefs for the session user", async () => {
      const context = await createAuthedContext("user-1");
      const next = {
        due: "overdue" as const,
        importanceMin: 3 as const,
        project: null,
        sort: "importance" as const,
        urgencyMin: null,
      };

      const saved = await call(preferencesRouter.updateTasksBoard, next, {
        context,
      });
      expect(saved).toEqual(next);

      const rows = await context.db
        .select({ tasksBoardPrefs: user.tasksBoardPrefs })
        .from(user)
        .where(eq(user.id, "user-1"))
        .limit(1);

      expect(JSON.parse(rows[0]?.tasksBoardPrefs ?? "{}")).toEqual(next);
    });
  });
});
