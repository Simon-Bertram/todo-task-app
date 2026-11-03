import { defineMiddleware } from "astro:middleware";
import {
  createRequestId,
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@todo-task-app/api/lib/app-error";

import { loadSessionUser } from "./lib/session.server";

const APP_PREFIXES = [
  "/today",
  "/matrix",
  "/tasks",
  "/projects",
  "/complete",
  "/settings",
  "/dashboard",
] as const;

function isAppPath(pathname: string): boolean {
  return APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.requestId = resolveRequestId(
    context.request.headers.get(REQUEST_ID_HEADER),
    createRequestId()
  );

  const { pathname } = context.url;

  if (pathname === "/onboarding/avatar") {
    const user = await loadSessionUser(context.request);
    if (!user) {
      return context.redirect("/login");
    }
    if (user.image) {
      return context.redirect("/today");
    }
    return next();
  }

  if (!isAppPath(pathname)) {
    return next();
  }

  const user = await loadSessionUser(context.request);
  if (user && !user.image) {
    return context.redirect("/onboarding/avatar");
  }

  return next();
});
