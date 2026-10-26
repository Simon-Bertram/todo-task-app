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
| Scheduled jobs (Post-V1) | Cloudflare Workers Cron Triggers on the existing `apps/server` Worker via Alchemy—not a third Worker and not Astro |

**V1 scope:** Eisenhower Matrix planning UI, time-budgeted Today execution view, capacity engine (incl. 1-3-5 filter), projects/categories, task CRUD with recurrence-on-complete, desktop DnD + mobile sheet/toggle flows, Matrix ↔ Today information architecture below.

**V1 non-goals:** Durable Objects, WebSockets, multi-tenant workspaces (schema may reserve optional `workspace_id` only), Cmd+K quick capture, Focus Mode / Pomodoro, two-way calendar sync, weekly analytics dashboard, sequential blockers / sub-checklists UI, and Workers Cron governance automation (see Post-V1 §§4.6–4.7). Schema may still reserve columns/tables for Post-V1 without exposing UI.

Respect **V1 vs Post-V1** labels in this document when implementing.

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

### 4.2.1 Matrix ↔ Today information architecture (V1)

**Mental model:** Matrix = **Planning** (priority placement). Today = **Execution** (capacity-bound day). `is_today` is a **status overlay**, not a fifth matrix cell. Matrix and Today are **peer** primary nav destinations (Matrix | Today), not nested.

#### Desktop — classic 2×2

- Four equal panels: Q1 top-left, Q2 top-right, Q3 bottom-left, Q4 bottom-right.
- Labeled axes (Importance ↑, Urgency →) and short intent labels (Do First / Schedule / Streamline / Drop)—not emoji-only titles.
- Empty quadrants show a short empty state (do not shrink into tiny dead cells).
- Subtle tinted quadrant backgrounds with accessible contrast for text and chips.
- Primary Preact DnD island: drag between quadrants sets **default** ratings for that quadrant (see §4.4); fine-tune 0–3 in the details drawer.
- **Today dock:** persistent right sidebar or bottom tray (“Today · capacity bar”) that remains a valid drop target on the Matrix view. Dropping onto the dock (or a task’s Today control) sets `is_today = 1` **without** changing quadrant. Live capacity preview on hover/drop (green / amber / red).
- Competing drop semantics must stay clear: **quadrant drop = rating change**; **dock / Today control = Today flag only**.

#### Mobile — segmented full-width lists (no 2×2)

- Sticky segmented control with **text + count badges**: `Q1 Do First (n)` … `Q4 Drop (n)`—no emoji-dependent labels.
- One full-width list per segment; swipe or tap to switch.
- Quadrant moves: bottom-sheet urgency/importance controls and/or “Move to quadrant” action (optional long-press → Move menu)—not micro DnD between tiny cells.
- Today: primary path is a **Today toggle / “Add to Today”** control on the card or in the sheet (≥ 44×44px). Do not rely on a sticky Today drop zone that fights bottom navigation. Optional compact “Today · Xm left” chip may open the Today view or a half-sheet tray.

#### Matrix view — showing Today tasks

- Tasks with `is_today = 1` remain in their quadrant with elevation: left accent bar + “Today” **text** badge.
- Optional filter chips: All | Not on Today | On Today.
- Unscheduled backlog stays the default visual weight; Today-flagged tasks must not dominate Q2/Q3 planning.

#### Today view — showing matrix position

- Each card: small **color + text** quadrant chip (`Q1`–`Q4`), including muted Q4 if present.
- Default sort/group by **1-3-5** (Major / Medium / Quick); secondary: manual `sort_order` / due time—**not** by quadrant.
- Capacity bar sticky at top; adding from Matrix shows immediate workload delta.
- Nice-to-have: tapping a quadrant chip jumps to Matrix with that quadrant selected.

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

- **Library:** `@atlaskit/pragmatic-drag-and-drop` (pointer + touch where appropriate).
- **Desktop:**
  - Drag between Eisenhower quadrants → set default rating levels for that quadrant; fine-tune 0–3 in task details.
  - Drag onto the Today dock / Today control → set `is_today = 1` without changing quadrant.
  - Reorder inside Today → update `sort_order`.
- **Mobile:** Prefer sheet / “Move to quadrant” / Today toggle over cross-quadrant DnD; reorder inside Today when hit targets remain ≥ 44×44px.
- **Default ratings on quadrant drop** (threshold ≥ 2; medium as the safe default):

| Drop target | `is_urgent` | `is_important` |
|-------------|-------------|----------------|
| Q1 | 2 | 2 |
| Q2 | 1 | 2 |
| Q3 | 2 | 1 |
| Q4 | 1 | 1 |

### 4.5 Recurring Tasks

- **Patterns:** Daily, Weekdays, Weekly (specific days), Monthly, or custom interval (every X days). Encode in `recurrence_rule` (e.g. `DAILY`, `WEEKDAYS`, `WEEKLY:MON,FRI`).
- **Generation:** On complete, server computes next due date and creates the next instance (keep DB tidy; do not expand infinite future rows upfront).

### 4.6 Advanced Features & Integrations (Post-V1)

Not required for V1 UI. Schema may reserve fields (§6) ahead of implementation.

| Feature | Intent | Stack mapping |
|---------|--------|---------------|
| Global Quick Capture | Cmd/Ctrl+K palette for frictionless Inbox entry without leaving the current view | Preact island → oRPC create into Inbox |
| Focus Mode | Pomodoro-style timer that dims the UI; logs spent time vs estimate | Timer island; persist `actual_minutes` on the task |
| Two-Way Calendar Time Blocking | Sync Today tasks with duration into Google/Apple Calendar blocks | Better Auth OAuth plugins + calendar APIs |
| Weekly Analytics & Quadrant Review | Ratio of completed Q2 (strategic) vs Q3 (interruptions) | Read-only oRPC aggregates + chart island |
| Sequential Blockers & Sub-Checklists | Lightweight subtasks; “blocked by” another task; Today shows actionable work only | `blocked_by_task_id` + `subtasks`; filter blocked from Today |

### 4.7 Task Governance & Automation Rules (Post-V1)

Implemented later via **Cloudflare Workers Cron Triggers** on the existing `apps/server` Worker, provisioned through Alchemy in `packages/infra` (daily midnight job unless noted). Rule 3 also needs a **client + oRPC mutation guard**.

1. **3-Strike Reschedule:** Tasks past due move to a triage queue (`status = triage`). Each reschedule increments `snooze_count`. At 3 strikes, force drop, downgrade, or split.
2. **30-Day Auto-Archive:** Incomplete Q4 tasks older than 30 days → `status = archived`.
3. **One-In, One-Out Capacity Lock:** When Today workload ≥ 100% of capacity, reject adds (API + UI toast) until the user removes or defers a task. Not cron-only.
4. **Q2 Escalation:** Q2 tasks within 48 hours of `due_date` increment Urgency so they map into Q1.
5. **Inbox TTL:** Uncategorized Inbox items unassigned for 72 hours default toward Q4 ratings.
6. **Anti-Stacking for Recurring Tasks:** Missed recurring instances are marked `status = missed` (not carried over); generate a fresh instance for today.

## 5. Technical Architecture & Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Frontend shell | Astro (SSR) | `apps/web` |
| Interactive islands | Preact (`@astrojs/preact`) | Add when needed |
| Styling | Tailwind CSS | Mobile-first |
| Backend API | Hono + oRPC | `apps/server`, `packages/api` |
| Auth | Better Auth | `packages/auth` |
| Database | Cloudflare D1 + Drizzle | `packages/db` |
| Hosting | Cloudflare Workers via Alchemy | `packages/infra` (web + server) |
| Scheduled jobs (Post-V1) | Worker Cron Triggers | On `apps/server` via Alchemy |

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

### Tasks (V1 + reserved Post-V1 columns)

V1 needs the core columns below. Columns marked **reserved** may be added in early migrations even if unused by V1 UI (supports §§4.6–4.7 without breaking changes).

```text
tasks
  id TEXT PK
  user_id TEXT NOT NULL → user.id ON DELETE CASCADE
  project_id TEXT NULL → projects.id ON DELETE SET NULL
  workspace_id TEXT NULL           -- reserved for future multi-tenant
  blocked_by_task_id TEXT NULL → tasks.id ON DELETE SET NULL  -- reserved (Post-V1)
  title TEXT NOT NULL
  notes TEXT
  status TEXT DEFAULT 'active'    -- reserved: active | archived | missed | triage
  is_urgent INTEGER DEFAULT 0     -- 0–3
  is_important INTEGER DEFAULT 0  -- 0–3
  estimated_minutes INTEGER DEFAULT 30
  actual_minutes INTEGER DEFAULT 0  -- reserved (Focus Mode)
  due_date TEXT                   -- YYYY-MM-DD
  is_today INTEGER DEFAULT 0
  sort_order INTEGER DEFAULT 0
  snooze_count INTEGER DEFAULT 0  -- reserved (3-strike rule)
  is_completed INTEGER DEFAULT 0
  completed_at ...
  recurrence_rule TEXT            -- NULL | DAILY | WEEKDAYS | WEEKLY:... | etc.
  created_at ...
```

### Subtasks (reserved — Post-V1)

```text
subtasks
  id TEXT PK
  task_id TEXT NOT NULL → tasks.id ON DELETE CASCADE
  title TEXT NOT NULL
  is_completed INTEGER DEFAULT 0
  created_at ...
```

User scoping is via the parent task’s `user_id` (always join/authorize through the parent).

Suggested indexes:

- `(user_id, due_date, is_completed)`
- `(user_id, is_urgent, is_important)`
- `(user_id, is_today, sort_order)` for Today list
- `(user_id, status)` for triage / archive jobs (Post-V1)

## 7. Mobile-First & Non-Functional Requirements

- **Touch targets:** Primary controls ≥ 44×44px.
- **Bottom sheets:** Task details, recurrence, project moves, and quadrant moves on mobile use swipeable bottom sheets (not centered modals).
- **Performance budget:**
  - Initial page load: &lt; 1.2s over 4G
  - Island JS payload: &lt; 35KB gzipped
  - D1 query latency: &lt; 30ms median
- **Optimistic UI:** Checkbox toggles and reorders update Preact/local state immediately; rollback + toast on failure.

## 8. Agent checklist for feature work

1. Confirm behavior against this PRD and edit order in [AGENTS.md](../AGENTS.md). Respect **V1 vs Post-V1** labels—do not build Post-V1 surfaces unless the task explicitly asks for them.
2. Schema first (`packages/db`) → oRPC (`packages/api`) → server only if needed → `apps/web` islands → infra only for new bindings or cron.
3. Enforce `user_id` scoping on every read/write.
4. Prefer Preact islands for Matrix DnD, Today capacity UI, and drawers; follow §4.2.1 for Matrix ↔ Today presentation.
5. Run `pnpm exec ultracite fix` / `pnpm check` before finishing.
