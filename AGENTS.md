# Agent Guidance — Todo Task App

Always-on entrypoint for AI agents. Product detail lives in [docs/PRD.md](docs/PRD.md). Full Ultracite standards live in [`.agents/skills/ultracite/`](.agents/skills/ultracite/).

**Stack authority:** This Better-T-Stack monorepo is source of truth. Do **not** migrate toward embedded Hono-in-Astro, Lucia, or a single Worker. Implement PRD *product* features on the current architecture.

---

## Product (V1)

Edge-first personal task manager emphasizing intentional daily execution via the **Eisenhower Matrix** and a **time-budgeted Today view**.

- **Audience:** Overloaded professionals / indie hackers who need visual prioritization and realistic daily capacity.
- **Tenancy:** Multi-user with workspace readiness. Scope all data by `user_id`. Optional future `workspace_id` only—do not build multi-tenant workspaces in V1.
- **Sync:** Optimistic UI + `visibilitychange` / window-focus revalidation. No WebSockets or Durable Objects in V1.
- **Priorities:** `is_urgent` / `is_important` are 0–3 integers. Quadrants use threshold ≥ 2 (Q1–Q4).
- **Today capacity:** Default 300 minutes (5h), user-configurable 2–8 hours. Live workload bar (green &lt; 75%, amber 75–100%, red &gt; 100%). Support 1-3-5 recommended filter.
- **UX:** Mobile-first (44×44px hit targets; bottom sheets on mobile). Island JS payload budget &lt; 35KB gzipped.

Read [docs/PRD.md](docs/PRD.md) before implementing features (DnD, recurrence, capacity engine, schema).

---

## Architecture (actual)

| Path | Role |
|------|------|
| `apps/web` | Astro SSR + Tailwind. Prefer **Preact** (`@astrojs/preact`) for interactive islands; vanilla `<script>` only for tiny toggles. Add Preact when first needed. |
| `apps/server` | Hono Cloudflare Worker: Better Auth at `/api/auth/*`, oRPC at `/rpc` |
| `packages/api` | oRPC routers, Zod, `publicProcedure` / `protectedProcedure` |
| `packages/db` | Drizzle ORM + D1 schema and migrations |
| `packages/auth` | Better Auth server config (not Lucia) |
| `packages/infra` | Alchemy IaC: D1, web Worker, server Worker (no `wrangler.toml`) |
| `packages/config` | Shared TypeScript base config |

Dev: web `http://localhost:4321`, API `http://localhost:3000`. Cross-origin cookies are intentional.

---

## Where to edit (and in which order)

Default vertical slice for feature work:

1. **`packages/db`** — schema + relations + `pnpm run db:generate`
2. **`packages/api`** — oRPC procedures + Zod (always session-scoped via `protectedProcedure`)
3. **`apps/server`** — only if changing Hono mounts, middleware, or Worker bindings usage
4. **`apps/web`** — pages, layouts, Preact islands, `src/lib/orpc.ts` / auth client
5. **`packages/infra`** — only if adding Cloudflare resources or bindings; then update env schemas (`.env.schema` + `pnpm run env:generate`)

Shortcuts:

- **UI-only** (copy, layout, static): `apps/web` alone.
- **API contract change:** `packages/api` → web client.
- **New CF binding/resource:** `packages/infra` + env schemas → consumers.
- **Auth config:** `packages/auth` (+ Better Auth skills); never invent a parallel `users` table—extend Better Auth’s `user` (e.g. `daily_capacity_minutes`) carefully.

Every query/mutation must enforce user session boundaries (`user_id` = session user).

---

## Skill and docs routing

Read the matching skill **before** coding that area:

| Area | Read first |
|------|------------|
| Product / domain rules | [docs/PRD.md](docs/PRD.md) |
| Lint / format / code standards | [`.agents/skills/ultracite/SKILL.md`](.agents/skills/ultracite/SKILL.md) and [`references/code-standards.md`](.agents/skills/ultracite/references/code-standards.md) |
| oRPC (procedures, routers, clients) | Stack is **oRPC v2 (beta)** (`2.0.0-beta.46`). Follow [`.agents/skills/orpc/SKILL.md`](.agents/skills/orpc/SKILL.md); for OpenAPI/REST also [`.agents/skills/orpc-openapi/SKILL.md`](.agents/skills/orpc-openapi/SKILL.md). Prefer repo patterns in [`packages/api`](packages/api) and [`apps/server/src/index.ts`](apps/server/src/index.ts); verify via [orpc.dev/llms.txt](https://orpc.dev/llms.txt). [`orpc-migrate`](.agents/skills/orpc-migrate/SKILL.md) is historical/reference only. Contract-first: [`orpc-contract`](.agents/skills/orpc-contract/SKILL.md) when relevant. |
| Hono API Worker | [`.agents/skills/hono/SKILL.md`](.agents/skills/hono/SKILL.md); Cloudflare `workers-best-practices` skill |
| Auth | [`.agents/skills/better-auth-best-practices/SKILL.md`](.agents/skills/better-auth-best-practices/SKILL.md); security / email-password skills as needed |
| D1 / Drizzle | `packages/db`; drizzle-kit skill under `packages/db/node_modules/drizzle-kit/skills/drizzle/`; Cloudflare `cloudflare` skill D1 references |
| Turborepo / monorepo tasks | [`.agents/skills/turborepo/SKILL.md`](.agents/skills/turborepo/SKILL.md) |
| Hosting / bindings | [`packages/infra/alchemy.run.ts`](packages/infra/alchemy.run.ts) first. Alchemy owns provisioning; use `wrangler` skill only for CLI/debug patterns |
| Perf budgets | Cloudflare `web-perf` skill when optimizing load / island size |

Docs MCPs (see [`.cursor/mcp.json`](.cursor/mcp.json)): `astro-docs`, `cloudflare-docs`, `better-auth`, `context7`, `better-t-stack`. No app-runtime oRPC MCP server.

---

## Ultracite (quick reference)

This project uses **Ultracite** (Biome) for formatting and linting.

- Format: `pnpm exec ultracite fix` (or `pnpm fix`)
- Check: `pnpm exec ultracite check` (or `pnpm check`)
- Diagnose: `pnpm exec ultracite doctor`

Core principles: accessible, performant, type-safe, maintainable. Prefer explicit types, `unknown` over `any`, `const`, early returns, semantic HTML/ARIA, no `console.log` in production code. For Astro/Preact islands, keep hooks top-level and use stable `key`s.

Do not duplicate full standards here—follow [`.agents/skills/ultracite/references/code-standards.md`](.agents/skills/ultracite/references/code-standards.md). Run `pnpm exec ultracite fix` before committing.
