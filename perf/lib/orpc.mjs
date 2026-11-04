import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

/**
 * Untyped oRPC client for perf scripts (cookie auth via Cookie header).
 * @param {{ apiUrl: string, cookieHeader: string }} options
 */
export function createPerfOrpcClient({ apiUrl, cookieHeader }) {
  const link = new RPCLink({
    fetch(url, options) {
      const headers = new Headers(options?.headers);
      headers.set("cookie", cookieHeader);
      return fetch(url, {
        ...options,
        headers,
      });
    },
    origin: apiUrl.replace(/\/$/, ""),
    url: "/rpc",
  });

  return createORPCClient(link);
}

export async function timedCall(label, fn) {
  const started = performance.now();
  const result = await fn();
  const ms = performance.now() - started;
  return { label, ms, result };
}

export function isPerfTitle(title) {
  return typeof title === "string" && title.startsWith("[perf]");
}
