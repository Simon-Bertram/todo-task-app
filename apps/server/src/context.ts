import type { Context as ApiContext } from "@todo-task-app/api/context";
import { preferLastDuplicateCookies } from "@todo-task-app/auth/session-cookie";
import type { Context as HonoContext } from "hono";

import { ENV } from "./env.server";
import { createAuth, getDb } from "./services";

export interface CreateContextOptions {
  context: HonoContext;
}

const TRAILING_SLASH = /\/$/;

function sessionLookupHeaders(requestHeaders: Headers): Headers {
  const rewritten = preferLastDuplicateCookies(requestHeaders.get("cookie"));
  if (!rewritten?.hadDuplicates) {
    return requestHeaders;
  }
  const headers = new Headers(requestHeaders);
  headers.set("cookie", rewritten.cookieHeader);
  return headers;
}

export async function createContext({
  context,
}: CreateContextOptions): Promise<ApiContext> {
  const db = getDb();
  const session = await createAuth(db).api.getSession({
    headers: sessionLookupHeaders(context.req.raw.headers),
  });
  const requestId = context.get("requestId");
  return {
    assetBaseUrl: ENV.BETTER_AUTH_URL.replace(TRAILING_SLASH, ""),
    avatars: ENV.AVATARS,
    db,
    hfToken: ENV.HF_TOKEN ?? "",
    requestId:
      typeof requestId === "string" && requestId.length > 0
        ? requestId
        : crypto.randomUUID(),
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
