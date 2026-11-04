import { experimental_CloudflareTracer as CloudflareTracer } from "@orpc/cloudflare";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import type { Context as ApiContext } from "@todo-task-app/api/context";
import {
  createRequestId,
  logStructuredError,
  REQUEST_ID_HEADER,
  resolveRequestId,
  serializeOrpcError,
} from "@todo-task-app/api/lib/app-error";
import { appRouter } from "@todo-task-app/api/routers/index";
import { sharedCookieDomain } from "@todo-task-app/auth";
import {
  appendHostOnlySessionCookieExpiry,
  cookieHeaderHasDuplicateSessionTokens,
} from "@todo-task-app/auth/session-cookie";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createContext } from "./context";
import { ENV } from "./env.server";
import { logOrpcError } from "./log-orpc-error";
import { createAuth } from "./services";

const sharedAuthCookieDomain = sharedCookieDomain(
  ENV.BETTER_AUTH_URL,
  ENV.CORS_ORIGIN
);

function maybeClearHostOnlySessionCookie(
  response: Response,
  cookieHeader: string | null
): Response {
  if (!sharedAuthCookieDomain) {
    return response;
  }
  if (!cookieHeaderHasDuplicateSessionTokens(cookieHeader)) {
    return response;
  }
  return appendHostOnlySessionCookieExpiry(response);
}

new CloudflareTracer().enable();

interface AppVariables {
  requestId: string;
}

const app = new Hono<{ Variables: AppVariables }>();

app.use(logger());

app.use("/*", async (c, next) => {
  const requestId = resolveRequestId(
    c.req.header(REQUEST_ID_HEADER),
    createRequestId()
  );
  c.set("requestId", requestId);
  c.header(REQUEST_ID_HEADER, requestId);
  await next();
});

app.use(
  "/*",
  cors({
    allowHeaders: ["Content-Type", "Authorization", REQUEST_ID_HEADER],
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    exposeHeaders: [REQUEST_ID_HEADER],
    origin: ENV.CORS_ORIGIN,
  })
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const auth = createAuth(undefined, (promise) => {
    c.executionCtx.waitUntil(promise);
  });
  const response = await auth.handler(c.req.raw);
  if (!sharedAuthCookieDomain) {
    return response;
  }
  // Expire leftover host-only session cookies on the API host after Domain=
  // was enabled — Set-Cookie with Domain= does not overwrite HostOnly twins.
  return appendHostOnlySessionCookieExpiry(response);
});

const openAPIGenerator = new OpenAPIGenerator({
  converters: [new ZodToJsonSchemaConverter()],
});

async function withOrpcErrorLogging<T>(options: {
  context: ApiContext;
  next: () => Promise<T>;
  path?: readonly string[];
  request?: {
    headers?: Headers | Record<string, string | string[] | undefined>;
  };
}): Promise<T> {
  try {
    return await options.next();
  } catch (error) {
    logOrpcError(error, {
      path: options.path,
      requestHeaders: options.request?.headers,
      requestId: options.context.requestId,
      userId: options.context.session?.user?.id ?? null,
    });
    throw error;
  }
}

export const apiHandler = new OpenAPIHandler(appRouter, {
  interceptors: [withOrpcErrorLogging],
  plugins: [
    new OpenAPIReferenceHandlerPlugin({
      provider: "scalar",
      spec: () =>
        openAPIGenerator.generate(appRouter, {
          base: { info: { title: "Todo Task App", version: "0.0.0" } },
        }),
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [withOrpcErrorLogging],
});

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    context,
    prefix: "/rpc",
  });

  if (rpcResult.matched) {
    const response = new Response(rpcResult.response.body, rpcResult.response);
    response.headers.set(REQUEST_ID_HEADER, c.get("requestId"));
    return maybeClearHostOnlySessionCookie(
      response,
      c.req.header("cookie") ?? null
    );
  }

  // OpenAPI/Scalar documents the authenticated surface — keep it off production.
  if (ENV.NODE_ENV !== "production") {
    const apiResult = await apiHandler.handle(c.req.raw, {
      context,
      prefix: "/api-reference",
    });

    if (apiResult.matched) {
      const response = new Response(
        apiResult.response.body,
        apiResult.response
      );
      response.headers.set(REQUEST_ID_HEADER, c.get("requestId"));
      return response;
    }
  }

  await next();
});

app.get("/", (c) => c.text("OK"));

const AVATAR_FILE = /^[0-9a-f-]{36}\.png$/i;

app.get("/media/avatars/:userId/:file", async (c) => {
  const userId = c.req.param("userId");
  const file = c.req.param("file");
  if (!(userId && file && AVATAR_FILE.test(file))) {
    return c.notFound();
  }

  const key = `${userId}/${file}`;
  const object = await ENV.AVATARS.get(key);
  if (!object) {
    return c.notFound();
  }

  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType ?? "image/png");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set(REQUEST_ID_HEADER, c.get("requestId"));
  return new Response(object.body, { headers });
});

app.onError((error, c) => {
  const requestId = c.get("requestId") ?? createRequestId();
  const serialized = serializeOrpcError(error);
  logStructuredError("hono.error", {
    code: serialized.code,
    message: serialized.message,
    path: c.req.path,
    requestId,
  });
  return c.json(
    {
      error: "Internal Server Error",
      requestId,
    },
    500
  );
});

export default app;
