/// <reference path="../../cloudflare-env.d.ts" />

import { env } from "cloudflare:workers";
import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { experimental_CloudflareTracer as CloudflareTracer } from "@orpc/cloudflare";
import {
  createRequestId,
  logStructuredError,
  REQUEST_ID_HEADER,
  resolveRequestId,
  serializeOrpcError,
  withRequestIdData,
} from "@todo-task-app/api/lib/app-error";
import type { AppRouterClient } from "@todo-task-app/api/routers/index";

import type { TasksBoardPrefs } from "@todo-task-app/api/schemas/tasks-board-prefs";
import { DEFAULT_TASKS_BOARD_PREFS } from "@todo-task-app/api/schemas/tasks-board-prefs";

import { ENV } from "../env.public";
import { mergeServiceBindingHeaders } from "./rpc-fetch-headers";
import type { Project, Task } from "./task-helpers";

new CloudflareTracer().enable();

const TRAILING_SLASH = /\/$/;

export interface AppBoardData {
  dailyCapacityMinutes: number;
  projects: Project[];
  tasks: Task[];
  tasksBoardPrefs: TasksBoardPrefs;
}

export interface ServerClientOptions {
  requestId?: string;
}

function resolveServerRequestId(request: Request, requestId?: string): string {
  return resolveRequestId(
    requestId ?? request.headers.get(REQUEST_ID_HEADER),
    createRequestId()
  );
}

export function createServerClient(
  request: Request,
  options?: ServerClientOptions
): AppRouterClient {
  const cookie = request.headers.get("cookie") ?? "";
  const requestId = resolveServerRequestId(request, options?.requestId);

  const link = new RPCLink({
    fetch(requestUrl, init) {
      // Use the SERVER service binding — global fetch to another same-zone
      // workers.dev Worker is blocked (Cloudflare error 1042).
      const headers = mergeServiceBindingHeaders(init?.headers, cookie);
      headers.set(REQUEST_ID_HEADER, requestId);
      return env.SERVER.fetch(requestUrl, {
        ...init,
        headers,
      });
    },
    headers: {
      ...(cookie ? { cookie } : {}),
      [REQUEST_ID_HEADER]: requestId,
    },
    origin: ENV.PUBLIC_SERVER_URL.replace(TRAILING_SLASH, ""),
    url: "/rpc",
  });

  return createORPCClient(link);
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ORPCError && error.code === "UNAUTHORIZED";
}

function logAndRethrowSsrError(error: unknown, requestId: string): never {
  const serialized = serializeOrpcError(error);
  logStructuredError("ssr.orpc.error", {
    code: serialized.code,
    message: serialized.message,
    requestId,
  });
  if (error instanceof ORPCError) {
    throw withRequestIdData(error, requestId);
  }
  throw error;
}

export async function loadAppBoardData(
  request: Request,
  options?: { includeCompleted?: boolean; requestId?: string }
): Promise<AppBoardData | "unauthorized"> {
  const requestId = resolveServerRequestId(request, options?.requestId);
  const client = createServerClient(request, { requestId });

  try {
    const [tasks, projects, preferences] = await Promise.all([
      client.tasks.list(
        options?.includeCompleted ? { includeCompleted: true } : undefined
      ),
      client.projects.list(),
      client.preferences.get(),
    ]);
    return {
      dailyCapacityMinutes: preferences.dailyCapacityMinutes,
      projects,
      tasks,
      tasksBoardPrefs: preferences.tasksBoard ?? DEFAULT_TASKS_BOARD_PREFS,
    };
  } catch (error) {
    if (isUnauthorized(error)) {
      return "unauthorized";
    }
    logAndRethrowSsrError(error, requestId);
  }
}

export async function loadCompletedBoardData(
  request: Request,
  range: "this_week" | "last_week" | "last_month" | "last_year" | "all",
  timeZone: string,
  options?: { requestId?: string }
): Promise<AppBoardData | "unauthorized"> {
  const requestId = resolveServerRequestId(request, options?.requestId);
  const client = createServerClient(request, { requestId });

  try {
    const [tasks, projects, preferences] = await Promise.all([
      client.tasks.listCompleted({ range, timeZone }),
      client.projects.list(),
      client.preferences.get(),
    ]);
    return {
      dailyCapacityMinutes: preferences.dailyCapacityMinutes,
      projects,
      tasks,
      tasksBoardPrefs: preferences.tasksBoard ?? DEFAULT_TASKS_BOARD_PREFS,
    };
  } catch (error) {
    if (isUnauthorized(error)) {
      return "unauthorized";
    }
    logAndRethrowSsrError(error, requestId);
  }
}
