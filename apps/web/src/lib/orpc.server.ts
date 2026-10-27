import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouterClient } from "@todo-task-app/api/routers/index";

import { ENV } from "../env.public";
import type { Project, Task } from "./task-helpers";

const TRAILING_SLASH = /\/$/;

export interface AppBoardData {
  projects: Project[];
  tasks: Task[];
}

function createServerClient(request: Request): AppRouterClient {
  const cookie = request.headers.get("cookie") ?? "";

  const link = new RPCLink({
    fetch(requestUrl, init) {
      return globalThis.fetch(requestUrl, {
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
    const [tasks, projects] = await Promise.all([
      client.tasks.list(),
      client.projects.list(),
    ]);
    return { projects, tasks };
  } catch (error) {
    if (isUnauthorized(error)) {
      return "unauthorized";
    }
    throw error;
  }
}
