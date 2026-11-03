import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { REQUEST_ID_HEADER } from "@todo-task-app/api/lib/app-error";
import type { AppRouterClient } from "@todo-task-app/api/routers/index";

import { ENV } from "../env.public";
import { shouldReportOrpcError } from "./orpc-errors";

let reporting = false;
let client: AppRouterClient | undefined;

async function reportClientError(
  error: unknown,
  path: readonly string[] | undefined
): Promise<void> {
  if (!(client && shouldReportOrpcError(error, path)) || reporting) {
    return;
  }
  reporting = true;
  try {
    const message =
      error instanceof Error ? error.message : "Unknown client error";
    const code = error instanceof ORPCError ? error.code : undefined;
    await client.errors.report({
      code,
      message,
      path: path?.join("."),
      source: "island",
      stack: error instanceof Error ? error.stack : undefined,
      url: globalThis.location?.href,
    });
  } catch {
    // Never surface reporting failures to the UI.
  } finally {
    reporting = false;
  }
}

export const link = new RPCLink({
  fetch(url, options) {
    const headers = new Headers(options?.headers);
    if (!headers.has(REQUEST_ID_HEADER)) {
      headers.set(REQUEST_ID_HEADER, crypto.randomUUID());
    }
    return globalThis.fetch(url, {
      ...options,
      credentials: "include",
      headers,
    });
  },
  interceptors: [
    async (options) => {
      try {
        return await options.next();
      } catch (error) {
        reportClientError(error, options.path).catch(() => undefined);
        throw error;
      }
    },
  ],
  origin: ENV.PUBLIC_SERVER_URL.replace(/\/$/, ""),
  url: "/rpc",
});

export const orpc: AppRouterClient = createORPCClient(link);
client = orpc;

export async function reportWindowError(
  error: unknown,
  source: "window" | "ssr-bridge" = "window"
): Promise<void> {
  if (!client || reporting) {
    return;
  }
  reporting = true;
  try {
    const message =
      error instanceof Error ? error.message : "Unhandled client error";
    await client.errors.report({
      message,
      source,
      stack: error instanceof Error ? error.stack : undefined,
      url: globalThis.location?.href,
    });
  } catch {
    // ignore
  } finally {
    reporting = false;
  }
}
