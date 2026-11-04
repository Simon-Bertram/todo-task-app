import { existsSync, readFileSync } from "node:fs";

/**
 * Build a Cookie header string from Playwright storageState.
 * Sends all cookies from the login state (scoped to the harness session).
 */
export function cookieHeaderFromStorageState(storageStatePath, _hosts) {
  if (!existsSync(storageStatePath)) {
    throw new Error(
      `Missing storage state at ${storageStatePath}. Run pnpm perf:auth first.`
    );
  }
  const state = JSON.parse(readFileSync(storageStatePath, "utf8"));
  const cookies = Array.isArray(state.cookies) ? state.cookies : [];
  if (cookies.length === 0) {
    throw new Error("storageState has no cookies; re-run perf:auth.");
  }
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

export function hostsFromUrls(...urls) {
  return urls.map((url) => new URL(url).hostname);
}
