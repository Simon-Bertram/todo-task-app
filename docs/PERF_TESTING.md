# Performance testing harness

CRUD-first performance suite for PlanSage against a live (or compare) URL. Primary goal: measure **task CRUD interaction cost** after `3880c09` (long-task progress indicator). Supporting gates cover PRD load, island JS, and API latency.

## PRD budgets

From [PRD.md](./PRD.md) §7:

| Budget | How this harness measures it |
|--------|------------------------------|
| Initial page load &lt; 1.2s on 4G | Lighthouse CI mobile + Slow 4G; assert **LCP ≤ 1200ms** on authenticated boards |
| Island JS payload &lt; 35KB gzipped | `perf:islands` sums island/`_astro` script transfer sizes per page |
| D1 query latency &lt; 30ms median | Client RTT to oRPC is a **proxy** (network + Worker + D1). Use Cloudflare Workers/D1 observability for true D1 p50. `perf:api` warns if client p50 &gt; 150ms |

## Regression focus (`3880c09`)

Baseline commit before progress UI: **`f066a9b`**. Live `https://todo.sarl` includes progress islands (pie/slider, GSAP dynamic import, sheet progress sync).

Run the CRUD bench on Short (ETC ≤ 60) vs Long (ETC &gt; 60) fixtures to isolate progress UI cost. Compare against a saved baseline or `PERF_COMPARE_URL` (e.g. a pre-progress deploy).

## Credentials (required)

Use a **dedicated** harness account — not a personal inbox.

| Variable | Required | Purpose |
|----------|----------|---------|
| `PERF_EMAIL` | yes | Harness account email |
| `PERF_PASSWORD` | yes | Harness account password |
| `PERF_BASE_URL` | no | Default `https://todo.sarl` |
| `PERF_API_URL` | no | Default `https://api.todo.sarl` |
| `PERF_COMPARE_URL` | no | Optional second web origin for compare mode |

Copy [`perf/.env.perf.example`](../perf/.env.perf.example) to `perf/.env.perf` (gitignored) and fill in values.

**One-time account prep**

1. Sign up on the target environment.
2. Verify email if required.
3. Complete avatar onboarding (`/onboarding/avatar`) so app routes are reachable.
4. Leave the account empty of personal tasks (harness seeds/cleans `[perf]`-prefixed titles only).

**Auth flow:** `pnpm perf:auth` signs in via the real login form, writes `perf/.auth/storageState.json` (gitignored). CRUD, API, and Lighthouse reuse that file for the same run. Prefer email/password over a hand-copied session cookie.

## Commands

From the repo root (after `pnpm install` and Playwright browsers):

```bash
# Load env from perf/.env.perf if present
pnpm perf:auth          # mint storageState
pnpm perf:crud          # CRUD interaction bench (primary)
pnpm perf:api           # oRPC list/create/update latency
pnpm perf:islands       # island JS transfer budget
pnpm perf:lh            # Lighthouse CI (mobile / Slow 4G)
pnpm perf:check         # auth → crud → api → islands → lh
pnpm perf:compare path/to/baseline.json path/to/candidate.json
```

Install browsers once: `pnpm --filter @todo-task-app/perf exec playwright install chromium`.

## CRUD scenarios

Authenticated Playwright against `PERF_BASE_URL`:

1. **Create** — quick-add dialog → settle (includes reload).
2. **Update** — open task sheet → change title → save → settle.
3. **Complete** — mark completed → save → settle (confetti path).
4. **Progress** — long task pie hotspot → `tasks.update` RPC.
5. **Add to Today** — sheet “Schedule to Today's board” → settle.

Fixtures are tagged `[perf]` and deleted after the run (and on startup cleanup).

## Dual-URL / baseline compare

- Save a run under `perf/results/<timestamp>/` (gitignored).
- `pnpm perf:compare perf/results/old/summary.json perf/results/new/summary.json` prints deltas and exits non-zero on configured regressions.
- Or set `PERF_COMPARE_URL`, run `perf:check` twice with different `PERF_BASE_URL` / `PERF_COMPARE_URL`, then compare artifacts.
- Intentional pre-progress baseline: build from `f066a9b` on a temporary stage when available.

## D1 latency notes

Client-measured oRPC p50 includes TLS, edge hop, Worker, and D1. The PRD’s **&lt; 30ms median** is D1-side. Check Cloudflare dashboard → Workers observability / D1 metrics for the authoritative number. The harness still probes mutations (`tasks.create`, progress-only `update`, complete `update`) vs `list` so API regressions show up.

## CI

[`.github/workflows/perf.yml`](../.github/workflows/perf.yml) runs on `workflow_dispatch` and a weekly schedule. Secrets: `PERF_EMAIL`, `PERF_PASSWORD`. Artifacts upload CRUD/LHCI JSON — never `storageState`.

## Safety

- Only the dedicated account’s data is mutated.
- Seed/cleanup titles must start with `[perf]`.
- Do not commit `.env.perf`, `perf/.auth/`, or `perf/results/`.
