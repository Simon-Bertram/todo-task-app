# Dependency management (pnpm catalog)

How this monorepo keeps shared dependency versions aligned. Use this before bumping packages that appear in more than one workspace, or any tightly coupled family (oRPC, Better Auth, Alchemy, Drizzle, Effect).

Package manager: **pnpm@12** (see root `packageManager`). Alignment tool: **pnpm catalog** in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml). Do not add syncpack or manypkg.

---

## Source of truth

| Mechanism | Where | Role |
|-----------|--------|------|
| `catalog:` | [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) → `catalog:` | Single declared version for shared / family deps |
| `"pkg": "catalog:"` | Each workspace `package.json` | Consumer opts into the catalog version |
| `workspace:*` | Internal `@todo-task-app/*` | Always use workspace protocol for monorepo packages |
| Root-owned | Root [`package.json`](../package.json) | Tooling only used at the root (`@biomejs/biome`, `ultracite`, `turbo`) |

Never pin a second literal version of a cataloged package in a workspace `package.json`. That reintroduces **skew**: the same dependency (or members of a coupled family) resolving to different versions across workspace packages. The catalog exists so everyone shares one declared version via `"catalog:"`; a local literal bypasses that and can leave peers half-satisfied or duplicate trees in the lockfile.

---

## What belongs in the catalog

Add a package to the catalog when **any** of these apply:

1. It is declared in **two or more** workspaces.
2. It is part of a **coupled family** (even if used in one package today)—so the next consumer cannot drift:
   - **oRPC:** `@orpc/server`, `@orpc/client`, `@orpc/openapi`, `@orpc/zod`, `@orpc/cloudflare`
   - **Better Auth:** `better-auth`, `@better-auth/core`, `@better-auth/drizzle-adapter`
   - **Alchemy:** `alchemy`, `@alchemy.run/cloudflare`, `@alchemy.run/frontend-frameworks`
   - **Drizzle:** `drizzle-orm`, `drizzle-kit`
   - **Effect (Alchemy peers):** `effect`, `@effect/platform-bun`, `@effect/platform-node`
3. It is shared toolchain used across packages: `typescript`, `@types/node`, `zod`, `varlock`, `@cloudflare/workers-types`, `vitest`.

### What stays local (not cataloged)

App- or package-specific libraries with caret ranges are fine:

- Web UI: `astro`, `@astrojs/preact`, `preact`, `tailwindcss`, GSAP, DnD, etc.
- Server: `hono`, `tsdown`
- Perf: `playwright`, `@lhci/cli`
- One-off: `resend`, `@huggingface/inference`, `@libsql/client`, `libsql`

Root-only tooling (`@biomejs/biome`, `ultracite`, `turbo`) stays in the root `package.json` unless a second workspace needs the same pin.

---

## Pinning policy

| Kind | Specifier style | Examples |
|------|-----------------|----------|
| Betas / RCs / fragile peers | **Exact** (`1.2.3` or `2.0.0-beta.46`) | `@orpc/*`, Alchemy, `drizzle-orm` / `drizzle-kit`, Effect |
| Stable shared libs | Exact or caret as already cataloged | `better-auth`, `varlock` |
| Stable float-safe tooling | Caret in catalog | `typescript`, `@types/node`, `zod`, `vitest`, `@cloudflare/workers-types` |
| Local app libs | Caret in that package only | `astro`, `hono`, `preact` |

When bumping a beta family, bump **every** catalog entry in that family in the same change.

### Intentional major holds

`pnpm outdated -r` may still report newer majors for these cataloged packages. Do **not** bump them in a routine outdated pass—treat each as its own migration PR:

| Package | Hold on | Reason |
|---------|---------|--------|
| `typescript` | `^6.0.3` (6.x) | TypeScript 7 is a major language/tooling shift |
| `vitest` | `^4.1.12` (4.x) | Vitest 5 is a major with stricter Node engines and ecosystem churn |

### Overrides (rare)

[`pnpm-workspace.yaml`](../pnpm-workspace.yaml) `overrides:` may force a single version when two transitive stacks disagree (pnpm 12 does not read `package.json` `pnpm.overrides`). Current override: `proxy-agent@8.0.2` — Alchemy’s `@puppeteer/browsers` peers `>=8.0.1`, while `@lhci/cli` still depends on `proxy-agent` `^6`. Prefer removing the override once LHCI moves to `proxy-agent` 8+.

### Ultracite / Biome companion config

When bumping root `ultracite` / `@biomejs/biome`, re-run `pnpm exec ultracite check` and expect new preset rules. This repo currently turns off nursery `useTailwindSortedClasses` and excludes `**/public/**` in [`biome.jsonc`](../biome.jsonc) so a routine tooling bump does not force a class-sort / static-asset lint migration in the same PR.

---

## Update recipes

### A. Bump a cataloged package (or family)

1. Edit the version(s) under `catalog:` in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml).
2. For a **family**, change every related entry together (see families above).
3. Consumers already on `"catalog:"` need no `package.json` version edits.
4. From the repo root:

```bash
pnpm install
pnpm peers check
pnpm outdated -r
```

5. Run the usual smoke path for the affected area (`pnpm check-types`, targeted tests, or `pnpm run dev` for Alchemy bumps).

### B. Newly catalog a package that was pinned locally

1. Add the version to `catalog:` in `pnpm-workspace.yaml`.
2. Replace the literal version in every consuming `package.json` with `"catalog:"`.
3. `pnpm install` → `pnpm peers check`.

### C. Update a single non-catalog dependency

```bash
pnpm update <pkg> --filter <workspace-name>
# or edit that package.json range, then:
pnpm install
```

Examples: `--filter web`, `--filter server`, `--filter @todo-task-app/db`.

### D. Add a new shared dependency

1. Prefer putting the version in `catalog:` first.
2. Add `"pkg": "catalog:"` to each workspace that needs it.
3. Avoid copying a literal version into multiple `package.json` files.

---

## Health checks

Run these after any dependency change and periodically:

| Check | Command | Expect |
|-------|---------|--------|
| Peer satisfaction | `pnpm peers check` | No unmet peers for workspace packages |
| Outdated survey | `pnpm outdated -r` | Review; do not blindly bump betas |
| Duplicate trees | Inspect `pnpm-lock.yaml` / install output | One resolved version per cataloged family |

### When to investigate duplicate lockfile trees

If the lockfile shows the same package at two versions (e.g. `@better-auth/core@1.7.12` and `@better-auth/core@1.7.18`):

1. Search workspace `package.json` files for a literal pin that bypasses the catalog.
2. Align the pin to the catalog version (or switch to `"catalog:"`).
3. Reinstall and confirm only one version remains for that family.

Peers that look “almost satisfied” (e.g. direct `effect@4.0.6` while a transitive package wants `^4.1.2`) usually mean the **direct Effect / platform pins** need to move with the transitive `@effect/*` line Alchemy pulls in—not an `.npmrc` override.

---

## Baseline fixes (applied with this guide)

These were the real consistency issues found when auditing the monorepo (declared same-name deps were already catalog-aligned):

1. **Better Auth:** `@better-auth/core` and `@better-auth/drizzle-adapter` were pinned at `1.7.12` while catalog `better-auth` was `1.7.18`. All three are now cataloged at `1.7.18`.
2. **Effect:** infra pinned `effect` / `@effect/platform-*` at `4.0.6` while transitive `@effect/sql-d1` / `@effect/platform-node-shared` at `4.1.2` required `effect` `^4.1.2`. Direct Effect packages are now cataloged at `4.1.2`.
3. **Catalog gaps closed:** Alchemy trio and `drizzle-kit` moved into the catalog next to their siblings.

After those changes, `pnpm peers check` should report a clean Effect peer graph for `apps/server` and `apps/web`.

---

## Agent checklist

Before merging a dependency PR:

- [ ] Shared / family versions changed only in `pnpm-workspace.yaml` `catalog:` (or newly added there)
- [ ] No new literal duplicate of a cataloged package in a workspace `package.json`
- [ ] Family members bumped together
- [ ] `pnpm install` + `pnpm peers check` clean
- [ ] Alchemy / auth / oRPC bumps cross-checked against their docs/skills ([`AGENTS.md`](../AGENTS.md) routing)
