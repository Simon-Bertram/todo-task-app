# Adding CRUD on this stack (oRPC + Hono + D1 + Astro)

A practical vertical-slice guide for this Better-T-Stack monorepo. Use it when adding a new resource (or finishing CRUD on an existing one). Worked example: **projects** and **tasks** (linked via `project_id`).

Product rules: [PRD.md](./PRD.md). Agent edit order: [AGENTS.md](../AGENTS.md). oRPC details: [`.agents/skills/orpc/SKILL.md`](../.agents/skills/orpc/SKILL.md).

---

## 1. Stack map

| Package / app | Owns | CRUD role |
|---------------|------|-----------|
| `packages/db` | Drizzle schema, relations, D1 migrations | Tables, FKs, indexes |
| `packages/api` | oRPC routers + Zod | Create / list / update / delete procedures |
| `apps/server` | Hono Worker: Better Auth + `RPCHandler` at `/rpc` | Usually **unchanged** when you only add routers |
| `apps/web` | Astro SSR + Preact islands | Load data, forms, mutations |
| `packages/auth` | Better Auth | Session; do not invent a parallel users table |
| `packages/infra` | Alchemy (D1 + Workers) | Only for new Cloudflare resources |

Browser client: [`apps/web/src/lib/orpc.ts`](../apps/web/src/lib/orpc.ts) (`credentials: "include"`).  
SSR client: [`apps/web/src/lib/orpc.server.ts`](../apps/web/src/lib/orpc.server.ts) (forwards cookies via the `SERVER` service binding).

---

## 2. Edit order (always)

1. **Schema** in `packages/db` → `pnpm run db:generate` when columns/tables change  
2. **oRPC** in `packages/api` (`protectedProcedure`, register on `appRouter`)  
3. **`apps/server`** only if mounts, middleware, or bindings change  
4. **`apps/web`** — SSR load + Preact island or small `<script>` mutations  
5. **Tests** in `packages/api` + Ultracite (`pnpm exec ultracite fix` / `pnpm check`)

Skip step 1 when the table already exists (projects/tasks already did).

---

## 3. Schema (Drizzle + D1)

Patterns that matter:

- Every user-owned row has `user_id` → `user.id` with `ON DELETE CASCADE`
- Related resources use nullable FKs when optional (e.g. `tasks.project_id` → `projects.id` `ON DELETE SET NULL`)
- Index filters you will query often (`user_id` + `project_id`, etc.)
- Prefer UUID text primary keys (`crypto.randomUUID()` in handlers)

Examples:

- [`packages/db/src/schema/projects.ts`](../packages/db/src/schema/projects.ts)
- [`packages/db/src/schema/tasks.ts`](../packages/db/src/schema/tasks.ts)
- Relations: [`packages/db/src/relations.ts`](../packages/db/src/relations.ts)

After schema edits, generate a migration and let Alchemy apply it on deploy/dev. Do not hand-edit production D1 outside migrations.

---

## 4. oRPC procedures

Build routers under [`packages/api/src/routers/`](../packages/api/src/routers/). Mount them on [`packages/api/src/routers/index.ts`](../packages/api/src/routers/index.ts).

### Baseline procedure shape

```ts
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";

export const thingsRouter = {
  create: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(100) }))
    .output(z.object({ id: z.string(), name: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      // insert with userId …
    }),

  list: protectedProcedure
    .output(z.array(/* … */))
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      // select where userId …
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().min(1), name: z.string().trim().min(1).optional() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      // update where id AND userId; throw NOT_FOUND if empty
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .output(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      // delete where id AND userId; throw NOT_FOUND if empty
    }),
};
```

### Rules

- Use **`protectedProcedure`** for anything user-owned (auth middleware throws `UNAUTHORIZED`)
- Never trust a client-supplied `userId` for authorization—always take it from `context.session.user.id`
- Scope every `where` with `eq(table.userId, userId)`
- Prefer `ORPCError("NOT_FOUND")` when the row is missing or not owned (avoid leaking existence across users)
- Use `ORPCError("BAD_REQUEST")` when a related FK is invalid (e.g. `projectId` belonging to another user)—see `assertProjectOwned` in [`tasks.ts`](../packages/api/src/routers/tasks.ts)
- Validate inputs with Zod (`.input` / `.output`)

### List filters

Optional filters belong on `list` input. Example from tasks:

```ts
projectId: z.string().nullable().optional()
// undefined = all; null = unassigned only; string = that project
```

Apply `eq` / `isNull` under the user-scoped conditions.

### Register the router

```ts
// packages/api/src/routers/index.ts
export const appRouter = {
  // …
  projects: projectsRouter,
  tasks: tasksRouter,
};
```

No Hono route change is required: [`apps/server/src/index.ts`](../apps/server/src/index.ts) already serves `appRouter` at `/rpc`.

---

## 5. Hono Worker — when to touch it

**Usually do nothing.** New procedures appear automatically once they are on `appRouter`.

Touch `apps/server` when you need:

- New middleware or CORS changes
- New Better Auth routes
- New Worker bindings (then also `packages/infra` + env schemas)

Cross-origin cookies between web (`:4321`) and API (`:3000`) are intentional; browser oRPC calls must use `credentials: "include"`.

---

## 6. Astro frontend

### SSR reads

Authenticated pages load data via the server client, then redirect if unauthorized:

```ts
const data = await loadAppBoardData(Astro.request);
if (data === "unauthorized") {
  return Astro.redirect("/login");
}
```

See [`apps/web/src/lib/orpc.server.ts`](../apps/web/src/lib/orpc.server.ts) and [`apps/web/src/pages/projects.astro`](../apps/web/src/pages/projects.astro).

### Mutations

- **Preact islands** for multi-field CRUD (create/edit sheets, filters)—e.g. [`project-board.tsx`](../apps/web/src/components/islands/project-board.tsx), [`task-detail-sheet.tsx`](../apps/web/src/components/islands/task-detail-sheet.tsx)
- **Vanilla `<script>`** for tiny one-shot forms (quick-add in [`app-shell.astro`](../apps/web/src/layouts/app-shell.astro))

Call `orpc.<resource>.create|update|delete(...)` from the browser client, then `location.reload()` (current convention). Keep hit targets ≥ 44×44px; use bottom sheets on mobile.

### Hydration

Pass SSR props into islands with `client:load` (or a lighter directive if the island is not needed immediately).

---

## 7. Linking related resources

1. **Schema:** nullable FK + clear `onDelete` (set null vs cascade)  
2. **API:** before create/update with a foreign id, assert the related row is owned by the same user  
3. **UI:**
   - Create with the parent locked (e.g. **Add task** on a project card → `tasks.create({ title, projectId })`)
   - Or a select of parents (quick-add / task detail → Inbox vs `#project`)
   - Move existing rows by updating the FK (`projectId: null` unassigns)

Projects page patterns: filter chips + per-project **Add task** in [`project-board.tsx`](../apps/web/src/components/islands/project-board.tsx).

---

## 8. Filter views

Two complementary layers:

1. **URL + UI filter** — e.g. `/projects?project=<id>|inbox` for shareable views; filter client-side or in SSR from the full list  
2. **API list filter** — pass `projectId` into `tasks.list` when you want the database to do the work (indexed `(user_id, project_id)`)

Start with URL + in-memory filter if the board already loads all open tasks; add API filtering when lists grow.

---

## 9. Tests checklist

Add Vitest coverage next to the router (see [`projects.test.ts`](../packages/api/src/routers/projects.test.ts), [`tasks.test.ts`](../packages/api/src/routers/tasks.test.ts)).

Use fixtures from [`packages/api/src/test/fixtures.ts`](../packages/api/src/test/fixtures.ts):

| Case | Assert |
|------|--------|
| Unauthed | `UNAUTHORIZED` on create/list/update/delete |
| Create | defaults + trimmed fields + returned id |
| Validation | empty strings / bad enums / bad colors rejected |
| List | only session user’s rows; ordering; optional filters |
| Update / delete | owned row works; other user’s id → `NOT_FOUND` |
| FK ownership | foreign `projectId` → `BAD_REQUEST` |
| Cascade / set null | delete parent leaves children in the expected state |

Run:

```bash
pnpm --filter @todo-task-app/api test
```

---

## 10. Done-when checklist

- [ ] Schema (if needed) + migration generated  
- [ ] `create` / `list` / `update` / `delete` on a `protectedProcedure` router  
- [ ] Router registered on `appRouter`  
- [ ] Every query/mutation scoped by session `user_id`  
- [ ] Related FKs ownership-checked  
- [ ] SSR page loads data (or island hydrated from SSR props)  
- [ ] UI can create, edit, delete, and (if linked) assign the parent  
- [ ] Filter view exists when the resource is a grouping (projects)  
- [ ] Router tests cover auth + isolation + happy path  
- [ ] `pnpm exec ultracite fix` / `pnpm check` clean  

---

## Worked example pointers

| Concern | Where |
|---------|--------|
| Project CRUD API | [`packages/api/src/routers/projects.ts`](../packages/api/src/routers/projects.ts) |
| Task CRUD + `projectId` list filter | [`packages/api/src/routers/tasks.ts`](../packages/api/src/routers/tasks.ts) |
| Projects manage + filter + add-task UI | [`apps/web/src/components/islands/project-board.tsx`](../apps/web/src/components/islands/project-board.tsx) |
| Task edit title / project / complete | [`apps/web/src/components/islands/task-detail-sheet.tsx`](../apps/web/src/components/islands/task-detail-sheet.tsx) |
| Quick-add with optional project | [`apps/web/src/layouts/app-shell.astro`](../apps/web/src/layouts/app-shell.astro) |
| Projects page entry | [`apps/web/src/pages/projects.astro`](../apps/web/src/pages/projects.astro) |
