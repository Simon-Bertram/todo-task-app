# Todo App — Product Requirements Document (PRD)

Agent entrypoint and edit-order routing: [AGENTS.md](../AGENTS.md).

## Implementation mapping (scaffold wins)

This repo uses **Better-T-Stack**, not the original “single Worker / embedded Hono / Lucia” sketch. Agents must implement product behavior on the stack below.

| PRD concept | Implement as |
|-------------|--------------|
| Frontend shell | Astro SSR in `apps/web` (Alchemy Cloudflare Website) |
| Interactive islands | **Preact** via `@astrojs/preact` when adding interactivity; vanilla `<script>` only for tiny toggles |
| Backend API | Hono Worker in `apps/server` + **oRPC** in `packages/api` (not Astro `api/[...slug]`) |
| Auth | **Better Auth** in `packages/auth` (email/password today; OAuth/magic links via Better Auth plugins—not Lucia) |
| Database | Cloudflare **D1** via **Drizzle** in `packages/db` |
| Hosting | Two Workers (web + server) provisioned by **Alchemy** in `packages/infra` |
| Users table | Better Auth already owns `user` / `session` / `account` / `verification`. **Do not** create a parallel `users` table. Add prefs (e.g. `daily_capacity_minutes`) by extending the Better Auth `user` schema carefully |
| Real-time | Optimistic UI + focus / `visibilitychange` revalidation only |

**V1 non-goals:** Durable Objects, WebSockets, multi-tenant workspaces (schema may reserve optional `workspace_id` only).

---

## 1. Executive Summary

An edge-first, high-performance personal task management application built with Astro, Preact islands, Hono/oRPC, and Cloudflare D1, hosted on Cloudflare Workers. The app emphasizes intentional daily execution using the Eisenhower Matrix (Urgency vs. Importance) and a Time-Budgeted "Today" View designed to prevent task overcommitment.

## 2. Target Audience & Core Persona

**Target Audience:** The Overloaded Professional / Indie Hacker.

**Core Need:** Manages multiple concurrent projects, struggles with endless flat checklists, and needs visual prioritization (Eisenhower Matrix) combined with realistic daily time forecasting and mobile-first responsiveness.

## 3. Architecture & Product Decisions

### Multi-User vs. Multi-Tenant

**V1 Model:** Multi-User with Workspace Readiness.

Each user manages personal tasks segregated by a `user_id` foreign key. An optional `workspace_id` column may be reserved for future team collaboration without breaking the schema. Do not implement workspace membership or sharing in V1.

### Real-Time Sync Strategy

**Decision:** Optimistic UI + Focus Revalidation (No WebSockets / Durable Objects in V1).

Instant optimistic local updates paired with `visibilitychange` / window focus revalidation provide a fast experience across devices. On mutation failure: rollback local state and show a toast.

### UI Islands Framework Priority

1. **Preact (primary):** ~4KB, React-hook compatible, preferred for drag-and-drop and drawers. Add `@astrojs/preact` when first interactive island is needed.
2. **Vanilla JS / HTML:** Ultra-light micro-interactions only (e.g. simple toggles).
3. **React:** Avoid unless strictly necessary (bundle overhead).

### Backend Strategy

Standalone Hono Worker (`apps/server`) with oRPC procedures (`packages/api`), Better Auth at `/api/auth/*`, and type-safe client usage from `apps/web`. Not an Astro catch-all API route.

## 4. Core Features & Functional Specifications

### 4.1 Authentication & User Scoping

- **Authentication:** Better Auth (email/password wired today). Prefer Better Auth plugins for OAuth (Google, GitHub) or magic links when adding those flows.
- **Data isolation:** All database queries and oRPC `protectedProcedure` handlers enforce session boundaries (`user_id` = authenticated user). Never trust client-supplied user IDs for authorization.

### 4.2 Task Attributes & Eisenhower Matrix

Each task contains:

- **Title & Description:** Markdown-supported notes.
- **Due Date & Optional Due Time:** ISO8601 (`due_date` as `YYYY-MM-DD`; time optional if modeled separately later).
- **Estimated Time to Complete (ETC):** Minutes (e.g. 15, 30, 60, 90).
- **Category / Project:** Color-coded project/label (`project_id`).
- **Priority ratings:** `is_urgent` and `is_important` are integers **0–3** (0 = None, 1 = Low, 2 = Medium, 3 = High).

Quadrant mapping uses threshold **≥ 2**:

| Quadrant | Rule | Intent |
|----------|------|--------|
| Q1 | Urgency ≥ 2, Importance ≥ 2 | Do First |
| Q2 | Urgency &lt; 2, Importance ≥ 2 | Schedule |
| Q3 | Urgency ≥ 2, Importance &lt; 2 | Delegate / Streamline |
| Q4 | Urgency &lt; 2, Importance &lt; 2 | Don't Do / Drop |

### 4.3 "Today's Tasks" Screen & Capacity Engine

- **Capacity budget:** Default **300 minutes** (5 focused hours), configurable **120–480 minutes** (2–8 hours) per user.
- **Live workload bar:** Sum of estimated minutes for Today vs daily budget.
  - Green: &lt; 75%
  - Amber: 75%–100%
  - Red / warning: &gt; 100% (e.g. “You have scheduled 6.5 hours of work for a 5-hour day. Consider deferring Q2/Q3 tasks.”)
- **1-3-5 recommended filter:**
  - 1 Major (60–120 mins)
  - 3 Medium (30–60 mins each)
  - 5 Quick wins (&lt; 15 mins each)

### 4.4 Drag-and-Drop Interaction

- **Library:** `@atlaskit/pragmatic-drag-and-drop` (pointer + touch).
- **Interactions:**
  - Drag between Eisenhower quadrants → set default rating levels for that quadrant; fine-tune 0–3 in task details.
  - Drag from Backlog/Inbox into Today.
  - Reorder inside Today → update `sort_order`.

### 4.5 Recurring Tasks

- **Patterns:** Daily, Weekdays, Weekly (specific days), Monthly, or custom interval (every X days). Encode in `recurrence_rule` (e.g. `DAILY`, `WEEKDAYS`, `WEEKLY:MON,FRI`).
- **Generation:** On complete, server computes next due date and creates the next instance (keep DB tidy; do not expand infinite future rows upfront).

## 5. Technical Architecture & Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Frontend shell | Astro (SSR) | `apps/web` |
| Interactive islands | Preact (`@astrojs/preact`) | Add when needed |
| Styling | Tailwind CSS | Mobile-first |
| Backend API | Hono + oRPC | `apps/server`, `packages/api` |
| Auth | Better Auth | `packages/auth` |
| Database | Cloudflare D1 + Drizzle | `packages/db` |
| Hosting | Cloudflare Workers via Alchemy | `packages/infra` |

## 6. D1 Schema Guidance (Drizzle)

Define schema in `packages/db` with Drizzle; generate migrations via `pnpm run db:generate`. Alchemy applies migrations on deploy.

### Users (Better Auth — extend, do not replace)

Existing table: `user` in [`packages/db/src/schema/auth.ts`](../packages/db/src/schema/auth.ts).

Add product prefs as columns on `user` (or a 1:1 prefs table keyed by `user_id`), for example:

- `daily_capacity_minutes` INTEGER DEFAULT 300

Follow Better Auth + Drizzle adapter guidance when extending the user schema (see Better Auth skills).

### Projects / categories (new)

```text
projects
  id TEXT PK
  user_id TEXT NOT NULL → user.id ON DELETE CASCADE
  name TEXT NOT NULL
  color TEXT DEFAULT '#3b82f6'
  workspace_id TEXT NULL          -- reserved for future multi-tenant
  created_at ...
```

### Tasks (new)

```text
tasks
  id TEXT PK
  user_id TEXT NOT NULL → user.id ON DELETE CASCADE
  project_id TEXT NULL → projects.id ON DELETE SET NULL
  workspace_id TEXT NULL           -- reserved for future multi-tenant
  title TEXT NOT NULL
  notes TEXT
  is_urgent INTEGER DEFAULT 0     -- 0–3
  is_important INTEGER DEFAULT 0  -- 0–3
  estimated_minutes INTEGER DEFAULT 30
  due_date TEXT                   -- YYYY-MM-DD
  is_today INTEGER DEFAULT 0
  sort_order INTEGER DEFAULT 0
  is_completed INTEGER DEFAULT 0
  completed_at ...
  recurrence_rule TEXT            -- NULL | DAILY | WEEKDAYS | WEEKLY:... | etc.
  created_at ...
```

Suggested indexes:

- `(user_id, due_date, is_completed)`
- `(user_id, is_urgent, is_important)`
- `(user_id, is_today, sort_order)` for Today list

## 7. Mobile-First & Non-Functional Requirements

- **Touch targets:** Primary controls ≥ 44×44px.
- **Bottom sheets:** Task details, recurrence, project moves on mobile use swipeable bottom sheets (not centered modals).
- **Performance budget:**
  - Initial page load: &lt; 1.2s over 4G
  - Island JS payload: &lt; 35KB gzipped
  - D1 query latency: &lt; 30ms median
- **Optimistic UI:** Checkbox toggles and reorders update Preact/local state immediately; rollback + toast on failure.

## 8. Agent checklist for feature work

1. Confirm behavior against this PRD and edit order in [AGENTS.md](../AGENTS.md).
2. Schema first (`packages/db`) → oRPC (`packages/api`) → server only if needed → `apps/web` islands → infra only for new bindings.
3. Enforce `user_id` scoping on every read/write.
4. Prefer Preact islands for DnD, Today capacity UI, and drawers.
5. Run `pnpm exec ultracite fix` / `pnpm check` before finishing.
