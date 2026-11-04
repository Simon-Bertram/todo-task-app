# Cross-subdomain auth cookies (`todo.sarl` ↔ `api.todo.sarl`)

Teaching note for contributors debugging **“SSR thinks I’m logged in, but browser calls to `/rpc` return 401”** — especially avatar onboarding (`Could not save avatar`).

---

## Why two hosts?

This monorepo follows Better-T-Stack’s split Workers layout (see [AGENTS.md](../AGENTS.md)):

| Host | Worker | Role |
|------|--------|------|
| `https://todo.sarl` | Astro (`apps/web`) | HTML, SSR, Preact islands |
| `https://api.todo.sarl` | Hono (`apps/server`) | Better Auth (`/api/auth/*`), oRPC (`/rpc`), avatar media |

Custom domains are declared in [`packages/infra/alchemy.run.ts`](../packages/infra/alchemy.run.ts). Locally the same split is `localhost:4321` (web) and `localhost:3000` (API).

Auth and data APIs live on the API Worker on purpose: one place for session cookies, D1, and rate limits. The web Worker stays a thin SSR edge that talks to the API via a **service binding** during SSR and via **cross-origin `fetch`** from islands in the browser.

Cross-origin cookies are intentional: Better Auth sets `SameSite=None; Secure` so the browser will attach the session cookie on requests from `todo.sarl` to `api.todo.sarl`.

---

## Two ways a request learns who you are

```text
SSR (page load on todo.sarl)
  Browser → todo.sarl (Cookie: Domain=.todo.sarl only)
       → service binding → api.todo.sarl /api/auth/get-session
       → HTML rendered with session

Island (avatar picker, etc.)
  Browser → api.todo.sarl /rpc/... (credentials: include)
       → createContext → getSession(Cookie header)
       → protectedProcedure or 401
```

- SSR session: [`apps/web/src/lib/session.server.ts`](../apps/web/src/lib/session.server.ts) forwards the incoming `Cookie` header over the service binding.
- Browser session: [`apps/web/src/lib/orpc.ts`](../apps/web/src/lib/orpc.ts) calls `PUBLIC_SERVER_URL` with `credentials: "include"`.

Those paths can disagree if the **cookie jars visible to each host** disagree.

---

## Why `Domain=.todo.sarl`?

Without a shared `Domain`, Better Auth would set a **host-only** cookie on `api.todo.sarl`. That cookie is sent to the API from the browser, but it is **not** sent to `todo.sarl`. Apex SSR would then see no session and bounce logged-in users to `/login`.

[`sharedCookieDomain`](../packages/auth/src/index.ts) detects that `api.todo.sarl` and `todo.sarl` share a parent and enables Better Auth `crossSubDomainCookies` with `Domain=.todo.sarl`. One cookie is then visible to both hosts.

**Security trade-off:** every host under `.todo.sarl` can receive the session cookie. Do not park untrusted apps on that apex. Production disables `workers.dev` sibling hosts for the same reason.

---

## Host-only vs Domain: same name, different cookies

A `Set-Cookie` with `Domain=.todo.sarl` does **not** replace an older cookie of the same name that was stored as **host-only** on `api.todo.sarl`. The browser keeps both.

On a request to `api.todo.sarl`, both are sent:

```http
Cookie: __Secure-better-auth.session_token=<stale-host-only>; __Secure-better-auth.session_token=<valid-domain>
```

Better Auth’s cookie parser (via `better-call`) keeps the **first** value only. Browsers typically send the more-specific host-only cookie first. If that token is expired or revoked, `getSession` returns `null` → oRPC `UNAUTHORIZED` (HTTP 401).

Apex SSR never sees the host-only cookie, so it still validates the Domain cookie and serves `/onboarding/avatar`. Islands then fail on `/rpc/avatars/generate` and `/rpc/avatars/commit`.

DevTools Application filtered to `todo.sarl` often shows only the Domain cookie. The leftover lives under **`https://api.todo.sarl`** (HostOnly true). Always check that host’s storage and the Network **Request → Cookie** header, not Application alone.

---

## Symptom that led here

1. User reaches avatar onboarding (SSR session OK).
2. Selecting or generating an avatar → UI “Could not save/generate avatar”.
3. Network: `POST https://api.todo.sarl/rpc/avatars/*` → **401**.
4. Console:

```js
await fetch("https://api.todo.sarl/api/auth/get-session", {
  credentials: "include",
}).then((r) => r.json());
// → null
```

5. Storage on `api.todo.sarl`: old HostOnly `__Secure-better-auth.session_token` (e.g. created before `Domain=.todo.sarl` was enabled).

Unverified email is a different path: `protectedProcedure` throws **403 FORBIDDEN**, not 401.

---

## Why we fixed it this way

We did **not** merge Workers or make avatar RPCs public. The split architecture is intentional; the bug was cookie jar migration after enabling cross-subdomain cookies.

1. **Request-time dedupe in `createContext`** — If the Cookie header has multiple session-token values, keep the **last** occurrence before `getSession`. That matches the usual “host-only first, Domain second” order so `/rpc` uses the shared cookie even when a leftover remains.
2. **Expire host-only on auth (and duplicate) responses** — Append `Set-Cookie` with the same name, `Max-Age=0`, **no** `Domain`, so the browser deletes the host-only entry on `api.todo.sarl` while leaving `Domain=.todo.sarl` alone. Auth responses always clear leftovers when a shared domain is configured; `/rpc` clears them when duplicates were detected on the request.
3. **Docs / clearer avatar UNAUTHORIZED copy** — So the next person finds this note and the UI points at session problems instead of a generic save failure.

Helpers live in [`packages/auth`](../packages/auth) (`session-cookie.ts`) so they stay unit-tested and shared by the server Worker.

---

## Manual unblock (no deploy)

1. DevTools → Storage → Cookies → **`https://api.todo.sarl`**.
2. Delete HostOnly `__Secure-better-auth.session_token` (blank/`api.todo.sarl` Domain).
3. Keep the `Domain=.todo.sarl` cookie from a recent sign-in (or sign in again).
4. Re-run the `get-session` fetch above — expect a user object.
5. Retry avatar commit.

Also clear both hosts after any change to cookie-domain logic; see [ALCHEMY_SETUP.md](./ALCHEMY_SETUP.md).

---

## Verify checklist

- [ ] Network Cookie on `/rpc` or `get-session` shows **one** `__Secure-better-auth.session_token`.
- [ ] Application: cookie on apex/API has `Domain=.todo.sarl`, HostOnly false.
- [ ] No HostOnly twin under `api.todo.sarl`.
- [ ] Avatar gallery “Use this avatar” succeeds after sign-in.
- [ ] Intentional junk HostOnly cookie + valid Domain cookie: `/rpc` still authenticates and the HostOnly entry is cleared on the response.
