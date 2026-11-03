# Error reporting (oRPC + Hono + Astro)

How this monorepo reports failures to **Cloudflare Workers Observability** and shows a **safe user-facing page** instead of a blank 500. Use this when extending error handling, or when diagnosing SSR/API failures like the historical `/complete` outage.

Product rules: [PRD.md](./PRD.md). Agent edit order: [AGENTS.md](../AGENTS.md). CRUD conventions: [ADDING_CRUD.md](./ADDING_CRUD.md).

---

## 1. Purpose

| Goal | How |
|------|-----|
| **Pick up** API and SSR failures | Structured `console.error(JSON.stringify(...))` events + Workers traces |
| **Correlate** web ↔ API | Shared `x-request-id` / `requestId` on context and logs |
| **Show** a useful page | Astro [`500.astro`](../apps/web/src/pages/500.astro) with mapped copy + reference ID |
| **Report** unexpected island/window errors | `errors.report` oRPC procedure (session-scoped) |

**Sink:** Cloudflare Workers Observability (logs + traces). No Sentry, Axiom, or D1 error inbox in this design.

---

## 2. Stack map

| Package / app | Owns |
|---------------|------|
| [`packages/api`](../packages/api) | `requestId` on context, [`lib/app-error.ts`](../packages/api/src/lib/app-error.ts) helpers, [`errors.report`](../packages/api/src/routers/errors.ts) |
| [`apps/server`](../apps/server) | Mint/echo `x-request-id`, structured oRPC `onError`, `app.onError`, CORS expose, CloudflareTracer |
| [`apps/web`](../apps/web) | Middleware `locals.requestId`, SSR log + rethrow, `500.astro`, browser link interceptor + optional window reporters |
| [`packages/infra`](../packages/infra) | `observability.traces.enabled` on web + server Workers |

Browser client: [`apps/web/src/lib/orpc.ts`](../apps/web/src/lib/orpc.ts).  
SSR client: [`apps/web/src/lib/orpc.server.ts`](../apps/web/src/lib/orpc.server.ts).

---

## 3. Failure walkthrough (`/complete`)

What went wrong historically:

1. SSR called `tasks.listCompleted` over the `SERVER` service binding.
2. A buggy header merge dropped RPC `Content-Type`, so the API saw a bad/missing body.
3. oRPC returned **`BAD_REQUEST` / “Input validation failed”** (400).
4. The web Worker rethrew → **blank platform 500** (no `500.astro`, no shared request id, only a raw `console.error`).

With this system in place:

```text
GET /complete
  → todo-web mints/forwards x-request-id
  → POST /rpc/tasks/listCompleted (same requestId)
  → todo-server logs event "orpc.error" (path, code, contentType, issues, requestId)
  → todo-web logs event "ssr.orpc.error" (same requestId)
  → User sees 500.astro + reference ID (no stack leak)
```

Search Workers logs/traces for that `requestId` to join both Workers.

---

## 4. Design choices

- **CF Observability over vendors** — JSON logs + `observability.traces`; no new secrets.
- **No D1 error table** — `errors.report` only writes structured logs.
- **`protectedProcedure` for reports** — avoid anonymous spam; skip reporting `UNAUTHORIZED` / expected toast paths.
- **Never show stacks or Zod issue dumps to users** — map codes via `userMessageForOrpcCode`.
- **Expected mutation failures stay toasts** — use `errors.report` for unexpected / unhandled client errors.

---

## 5. Build order (implement or extend)

### 5.1 Shared helpers + context + `errors.report`

1. Add `requestId: string` to [`packages/api/src/context.ts`](../packages/api/src/context.ts).
2. Helpers in [`packages/api/src/lib/app-error.ts`](../packages/api/src/lib/app-error.ts):
   - `REQUEST_ID_HEADER` (`x-request-id`)
   - `createRequestId()`
   - `serializeOrpcError(error)` for logs
   - `userMessageForOrpcCode(code)` / `userMessageForUnknownError(error)` for UI
   - `logStructuredError(event, fields)` → `console.error(JSON.stringify(...))`
3. Router [`packages/api/src/routers/errors.ts`](../packages/api/src/routers/errors.ts): `report` accepts capped message/stack, optional code/path/url/requestId, logs `client.error.report`, returns `{ ok, requestId }`.
4. Mount on [`appRouter`](../packages/api/src/routers/index.ts). Update test fixtures to include `requestId`.

### 5.2 Hono Worker

In [`apps/server/src/index.ts`](../apps/server/src/index.ts) + [`context.ts`](../apps/server/src/context.ts):

1. Early middleware: read or mint `x-request-id`, `c.set("requestId", …)`, set response header.
2. Pass `requestId` into API `createContext`.
3. oRPC `onError((error, options) => …)` → `event: "orpc.error"` with `requestId`, `path`, `code`, `message`, `userId`, `contentType`, validation `issues` when present.
4. `app.onError` for non-RPC routes → `event: "hono.error"`.
5. CORS: allow + expose `x-request-id`.
6. Enable `experimental_CloudflareTracer` from `@orpc/cloudflare` at module scope (same beta pin as other `@orpc/*`).

### 5.3 Alchemy traces

On both `Worker("server", …)` and `Website.Astro("web", …)` in [`packages/infra/alchemy.run.ts`](../packages/infra/alchemy.run.ts):

```ts
observability: {
  traces: { enabled: true },
},
```

(Non-Effect Worker shape — see [Alchemy Workers tracing](https://alchemy.run/cloudflare/observability/workers-tracing).)

### 5.4 Astro frontend

1. Middleware ([`apps/web/src/middleware.ts`](../apps/web/src/middleware.ts)): set `Astro.locals.requestId` for every request; extend [`App.Locals`](../apps/web/cloudflare-env.d.ts).
2. SSR client: forward `x-request-id` on service-binding fetch; on non-auth failure log `ssr.orpc.error` then rethrow (optionally stamp `requestId` onto `ORPCError.data`).
3. Pass `requestId: Astro.locals.requestId` into board loaders / `createServerClient`.
4. [`apps/web/src/pages/500.astro`](../apps/web/src/pages/500.astro): map error → safe copy + show reference ID from locals / error data.
5. Browser [`orpc.ts`](../apps/web/src/lib/orpc.ts): link `onError` interceptor reports unexpected failures via `errors.report` (skip `errors.report` itself and auth codes). Helpers in [`orpc-errors.ts`](../apps/web/src/lib/orpc-errors.ts).
6. App shell: optional `window` `error` / `unhandledrejection` → same report helper (guard against loops).

---

## 6. Verification

| Check | Expect |
|-------|--------|
| Force SSR oRPC validation failure | `500.astro` with friendly message + reference ID |
| Workers logs for `todo-server` | `event":"orpc.error"` with `path`, `contentType`, `requestId` |
| Workers logs for `todo-web` | `event":"ssr.orpc.error"` with same `requestId` |
| Traces (dashboard / local explorer) | Failed RPC span under the page request when tracer + traces enabled |
| Island unexpected throw / `errors.report` | `event":"client.error.report"` with `userId` |
| Expected toast failures (e.g. quick-add) | Still toast; no spam reports for handled catches unless you opt in |

Local: `pnpm run dev`, reproduce a bad SSR call, then inspect terminal / Workers Observability for the shared id.

---

## 7. Do / don’t

**Do**

- Throw `ORPCError` with stable codes from procedures ([ADDING_CRUD](./ADDING_CRUD.md)).
- Log with `logStructuredError` / the Hono `onError` shape (JSON one-liners).
- Show users `userMessageForOrpcCode` + reference ID only.
- Scope `errors.report` to signed-in users.

**Don’t**

- Leak stacks, Zod `issues`, or internal paths on `500.astro` or toasts.
- Persist errors to D1 without a product decision.
- Report every handled mutation failure (toasts already cover PRD rollback UX).
- Spread `Headers` into a plain object when forwarding RPC (see [`rpc-fetch-headers.ts`](../apps/web/src/lib/rpc-fetch-headers.ts)).

---

## 8. Related docs

| Doc | Relevance |
|-----|-----------|
| [PRD.md](./PRD.md) | Optimistic UI → toast on mutation failure |
| [ADDING_CRUD.md](./ADDING_CRUD.md) | `ORPCError` conventions (`NOT_FOUND`, `BAD_REQUEST`, …) |
| [`.agents/skills/orpc/SKILL.md`](../.agents/skills/orpc/SKILL.md) | Procedures, handlers, clients |
| [`.agents/skills/hono/SKILL.md`](../.agents/skills/hono/SKILL.md) | `app.onError`, middleware |
| [orpc.dev error handling](https://orpc.dev/docs/error-handling) | `ORPCError`, validation |
| [orpc.dev Cloudflare traces](https://orpc.dev/docs/integrations/cloudflare-traces) | `CloudflareTracer` |
