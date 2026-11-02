/// <reference path="../../cloudflare-env.d.ts" />

import { env } from "cloudflare:workers";
import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouterClient } from "@todo-task-app/api/routers/index";

import type { TasksBoardPrefs } from "@todo-task-app/api/schemas/tasks-board-prefs";
import { DEFAULT_TASKS_BOARD_PREFS } from "@todo-task-app/api/schemas/tasks-board-prefs";

import { ENV } from "../env.public";
import type { Project, Task } from "./task-helpers";

const TRAILING_SLASH = /\/$/;

export interface AppBoardData {
  projects: Project[];
  tasks: Task[];
  tasksBoardPrefs: TasksBoardPrefs;
}

function createServerClient(request: Request): AppRouterClient {
  const cookie = request.headers.get("cookie") ?? "";

  const link = new RPCLink({
    fetch(requestUrl, init) {
      // Use the SERVER service binding — global fetch to another same-zone
      // workers.dev Worker is blocked (Cloudflare error 1042).
      return env.SERVER.fetch(requestUrl, {
        ...init,
        headers: {
          ...init?.headers,
          cookie,
        },
      });
    },
    headers: cookie ? { cookie } : {},
    origin: ENV.PUBLIC_SERVER_URL.replace(TRAILING_SLASH, ""),
    url: "/rpc",
  });

  return createORPCClient(link);
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ORPCError && error.code === "UNAUTHORIZED";
}

export async function loadAppBoardData(
  request: Request
): Promise<AppBoardData | "unauthorized"> {
  const client = createServerClient(request);

  try {
    const [tasks, projects, preferences] = await Promise.all([
      client.tasks.list(),
      client.projects.list(),
      client.preferences.get(),
    ]);
    return {
      projects,
      tasks,
      tasksBoardPrefs: preferences.tasksBoard ?? DEFAULT_TASKS_BOARD_PREFS,
    };
  } catch (error) {
    if (isUnauthorized(error)) {
      return "unauthorized";
    }
    throw error;
  }
}
