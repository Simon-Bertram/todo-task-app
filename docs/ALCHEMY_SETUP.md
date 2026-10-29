# Alchemy setup (local `pnpm run dev`)

This repo’s local stack is owned by [`packages/infra`](../packages/infra). Root `pnpm run dev` runs Turbo, which runs `alchemy dev` from that package. Alchemy provisions Cloudflare resources (D1, KV, Workers) and starts the API on `:3000` and Astro on `:4321`.

You need working **Cloudflare credentials** before `alchemy dev` succeeds. App `.env` values alone are not enough.

Official references:

- [Cloudflare setup](https://alchemy.run/cloudflare/setup/)
- [Profiles](https://alchemy.run/environments/profiles/)
- [Secrets & env](https://alchemy.run/cloudflare/security/secrets-env/)
- [State store](https://alchemy.run/state-store/)
- [`alchemy profile` CLI](https://alchemy.run/cli/profile/)

---

## Critical: CLI gotchas (read this first)

### There is no `alchemy configure`

Alchemy **2.0.0-beta.84** (this repo) does **not** have `alchemy configure`. Auth is managed only through:

```bash
cd packages/infra
pnpm exec alchemy profile …
```

### “Provider 'Cloudflare' is already connected”

That message means Alchemy’s profile (usually `default`) **already has a Cloudflare credential entry** under `~/.alchemy`. It does **not** mean the token is valid or that `alchemy dev` will work.

- **`--add Cloudflare`** — only for the **first** time Cloudflare is linked to a profile. If anything is already stored, it fails with “already connected”.
- **`--reconfigure Cloudflare`** — **replace** the stored credentials (wrong token, expired OAuth, under-scoped token, `Unauthorized` on deploy). **Use this when Cloudflare is already connected.**

Check what Alchemy thinks is linked:

```bash
cd packages/infra
pnpm exec alchemy profile show
```

Example when Cloudflare is already connected (token redacted):

```text
* default
  Cloudflare (stored) — connected
    apiToken: cfut_****
    accountId: …
    source: stored
```

If you see that and still get `Unauthorized: Authentication error`, the stored token is stale or missing required permissions. Reconfigure; do not keep calling `--add`.

---

## 1. Prerequisites

- A Cloudflare account (free plan is enough)
- Verified account email
- Production zone **`todo.sarl`** on Cloudflare (active; nameservers at Cloudflare)
- Node 22+ (or Bun)
- From the repo root: `pnpm install`

### Production hosts (`todo.sarl`)

| Role | Hostname |
|------|----------|
| Web (Astro) | `https://todo.sarl` (`www.todo.sarl` → 301) |
| API / Better Auth | `https://api.todo.sarl` |
| Auth email From (Resend) | `PlanSage <noreply@mail.todo.sarl>` |

Custom domains are declared in [`packages/infra/alchemy.run.ts`](../packages/infra/alchemy.run.ts) (`domain` + `workersDev: false`). Deploy attaches them once the zone exists.

**Local `pnpm run dev`** still uses `http://localhost:4321` (web) and `http://localhost:3000` (API). Set:

- `CORS_ORIGIN=http://localhost:4321`
- `BETTER_AUTH_URL=http://localhost:3000`
- `PUBLIC_SERVER_URL=http://localhost:3000` (web)

**Production deploy** env:

- `CORS_ORIGIN=https://todo.sarl`
- `EMAIL_FROM=PlanSage <noreply@mail.todo.sarl>`
- `RESEND_API_KEY=…` (Resend dashboard)
- `BETTER_AUTH_URL` is supplied by Alchemy as `Worker.URL` → `https://api.todo.sarl`

Auth sets session cookies with `Domain=.todo.sarl` so the apex web Worker can forward them to the API during SSR. After changing cookie-domain logic in `@todo-task-app/auth`, redeploy the **server** Worker, clear site cookies for `todo.sarl` / `api.todo.sarl` (or sign out), then sign in again—old host-only cookies on `api.todo.sarl` will not migrate. Confirm DevTools shows the session cookie with `Domain=.todo.sarl`, then `/today` should render the app shell instead of bouncing to `/login`.

### Resend domain (`mail.todo.sarl`)


Auth verification and password-reset emails go through Resend (not Fastmail). Fastmail is optional and only for a personal `@todo.sarl` inbox.

1. Domain `mail.todo.sarl` is registered in Resend (or add it under [Domains](https://resend.com/domains)).
2. In the Cloudflare DNS UI for `todo.sarl`, add the records from the Resend domain page for `mail.todo.sarl` (DNS Write). Current Resend values (re-check the dashboard if rotated):

| Type | Name | Content / priority |
|------|------|--------------------|
| TXT | `resend._domainkey.mail` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCrEf72ZoML4BgNA0lHE6sCnVRYo697oNsCMmMzUm2WyC7nLLtgPxhlod5i8TDU7IfpGjsCXHZVqtzHt53Z8ZWbpHKERC1ikDDKuIOoi10TwJSbOOZ18DQZsauJi8w+WdO88vh5LzB932admCC14x5n+tTTMgj2xiPPxXBVu1JL0QIDAQAB` |
| MX | `send.mail` | `feedback-smtp.us-east-1.amazonses.com` (priority `10`) |
| TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` |
| CNAME | `rsend.mail` | `send.forge.rmta.net` (**DNS only**, not proxied) |

Keep apex MX free unless you intentionally add a mailbox provider (Fastmail is optional and unrelated to auth sends).

3. In Resend, click **Verify** / wait until status is **Verified** (often minutes after DNS propagates).
4. Ensure `EMAIL_FROM=PlanSage <noreply@mail.todo.sarl>`.

---

## 2. Connect Cloudflare with an API token

All commands below assume:

```bash
cd packages/infra
```

### Create a token with enough scope

Create an API token in the Cloudflare dashboard. For this app (Workers, D1, KV, and Alchemy’s Cloudflare state store bootstrap), include at least:

- Workers Scripts Write
- Workers KV Storage Write
- D1 Write
- Secrets Store Write
- Account Settings Write
- Workers Tail Read (if you use `alchemy logs`)

See Alchemy’s [CI tutorial permission list](https://alchemy.run/cloudflare/tutorial/part-5/) for the same shape of scopes.

Also note your **Account ID** (Cloudflare dashboard → account overview).

### Option A — Write the token into the Alchemy profile (recommended)

Export both values (do not commit them):

```bash
export CLOUDFLARE_API_TOKEN='your-token'
export CLOUDFLARE_ACCOUNT_ID='your-account-id'
```

**If Cloudflare is not connected yet:**

```bash
pnpm exec alchemy profile edit --add Cloudflare --method stored \
  --set apiToken=env:CLOUDFLARE_API_TOKEN \
  --set accountId=env:CLOUDFLARE_ACCOUNT_ID
```

**If Cloudflare is already connected** (the usual case after a failed first attempt):

```bash
pnpm exec alchemy profile edit --reconfigure Cloudflare --method stored \
  --set apiToken=env:CLOUDFLARE_API_TOKEN \
  --set accountId=env:CLOUDFLARE_ACCOUNT_ID
```

Interactive reconfigure (prompts for OAuth vs paste token):

```bash
pnpm exec alchemy profile edit --reconfigure Cloudflare
```

Or open the full profile menu:

```bash
pnpm exec alchemy profile edit
```

In the menu, cycle Cloudflare to **re-configure**, then confirm. Prefer OAuth when a browser works; on Cloudflare’s consent screen enable **Account API Token Provisioning** under Sensitive scopes ([setup docs](https://alchemy.run/cloudflare/setup/)).

### Option B — Env vars only (no profile rewrite)

If **both** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set in the process environment, Alchemy uses them for Cloudflare and **ignores** the profile for that provider. Partial env (only one of the two) is ignored and the profile is used instead.

This matches the host → container forwarding in [`.devcontainer/devcontainer.json`](../.devcontainer/devcontainer.json).

```bash
export CLOUDFLARE_API_TOKEN='your-token'
export CLOUDFLARE_ACCOUNT_ID='your-account-id'
pnpm run dev
```

### Verify

```bash
pnpm exec alchemy profile show
```

You should see Cloudflare connected with a redacted token and the correct `accountId`.

---

## 3. App secrets (Varlock)

Alchemy loads deployment inputs via `varlock/auto-load` in [`packages/infra/alchemy.run.ts`](../packages/infra/alchemy.run.ts). Worker secrets/config use Effect `Config` bindings (see [Secrets & env](https://alchemy.run/cloudflare/security/secrets-env/)).

| File | Required for local |
|------|--------------------|
| [`apps/server/.env`](../apps/server/.env) | `BETTER_AUTH_SECRET` (≥32 chars), `CORS_ORIGIN=http://localhost:4321`, `BETTER_AUTH_URL=http://localhost:3000`, `RESEND_API_KEY`, `EMAIL_FROM` (use `PlanSage <noreply@mail.todo.sarl>` once Resend is verified; `onboarding@resend.dev` only for self-inbox tests) |
| [`apps/web/.env`](../apps/web/.env) | `PUBLIC_SERVER_URL=http://localhost:3000` |
| [`packages/infra/.env.schema`](../packages/infra/.env.schema) | Imports server secrets including Resend; optional `ALCHEMY_PASSWORD` |

[`packages/infra/.env.schema`](../packages/infra/.env.schema) imports `NODE_ENV`, `CORS_ORIGIN`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, and `EMAIL_FROM` from the server app. You usually do not need a separate `packages/infra/.env` for local if those values exist under `apps/server/.env`.

Optional: set `ALCHEMY_PASSWORD` on the host/container (devcontainer already forwards it) if you rely on Alchemy password-based secret encryption.

After changing a `.env.schema`, regenerate types from the repo root:

```bash
pnpm run env:generate
```

---

## 4. State store note

The Better-T-Stack scaffold commits `state: Cloudflare.state()` in `alchemy.run.ts`. On first `alchemy dev` / `deploy`, Alchemy creates the account-wide Worker `alchemy-state-store` (and related Secrets Store entries). That is what produces:

```text
Cloudflare State Store 'alchemy-state-store' not found; deploying it.
```

If that step fails with `Unauthorized: Authentication error`, fix Cloudflare credentials (`--reconfigure`) — do not treat it as a missing app `.env` key.

You can bootstrap the store explicitly:

```bash
cd packages/infra
pnpm exec alchemy state bootstrap --backend cloudflare
```

Outside CI, `alchemy dev` / `alchemy deploy` usually create it automatically when credentials work.

If the working tree uses `localState()` instead, Alchemy writes stack state under `.alchemy/` on disk and skips the remote state-store Worker. **Cloudflare API auth is still required** for D1, KV, and Workers.

---

## 5. Commands from `packages/infra`

Scripts in [`packages/infra/package.json`](../packages/infra/package.json):

| Command | What it does |
|---------|----------------|
| `pnpm exec alchemy profile show` | Inspect linked providers (redacted) |
| `pnpm exec alchemy profile edit --add Cloudflare …` | First-time Cloudflare link only |
| `pnpm exec alchemy profile edit --reconfigure Cloudflare …` | Replace Cloudflare credentials when already connected |
| `pnpm exec alchemy state bootstrap --backend cloudflare` | Provision/adopt remote state store |
| `pnpm run dev` | `alchemy dev` — local Workers + cloud resources; stage defaults to `dev_$USER` |
| `pnpm run deploy` | `alchemy deploy` — default stage `live_$USER` |
| `pnpm run destroy` | `alchemy destroy` — tear down a stage |

Production deploy example:

```bash
cd packages/infra
pnpm exec alchemy deploy --stage production
```

From the **repo root**, after auth works:

```bash
pnpm run dev
```

Then open http://localhost:4321 (web) and http://localhost:3000 (API).

---

## 6. Recovery checklist

| Symptom | What to do |
|---------|------------|
| `Unknown subcommand "configure"` | Use `alchemy profile`, not `alchemy configure` |
| `Provider 'Cloudflare' is already connected` | Use `--reconfigure Cloudflare`, not `--add` |
| `Unauthorized: Authentication error` while deploying `alchemy-state-store` | Reconfigure with a valid, sufficiently scoped token + correct account id |
| `alchemy profile show` shows connected but `dev` still Unauthorized | Stored token is bad; reconfigure or set both env vars |
| D1 HTTP migrate from `packages/db` asks for account/database/token | Skip for day-to-day; Alchemy applies migrations from the path in `alchemy.run.ts` during `dev`/`deploy` |
| Sign-in succeeds but `/today` redirects to `/login` | Session cookie not shared with apex: redeploy server, clear `todo.sarl` / `api.todo.sarl` cookies, sign in again; cookie must use `Domain=.todo.sarl` |

After first production deploy, set `CORS_ORIGIN=https://todo.sarl` (and confirmed Resend `EMAIL_FROM`) for the deploy stage and deploy again (see [README](../README.md)).
