import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PERF_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }
  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile(resolve(PERF_ROOT, ".env.perf"));

export const PERF_PREFIX = "[perf]";

export function getPerfConfig() {
  const email = process.env.PERF_EMAIL?.trim();
  const password = process.env.PERF_PASSWORD?.trim();
  if (!(email && password)) {
    throw new Error(
      "PERF_EMAIL and PERF_PASSWORD are required. See docs/PERF_TESTING.md and perf/.env.perf.example."
    );
  }

  const baseUrl = (process.env.PERF_BASE_URL ?? "https://todo.sarl").replace(
    /\/$/,
    ""
  );
  const apiUrl = (process.env.PERF_API_URL ?? "https://api.todo.sarl").replace(
    /\/$/,
    ""
  );

  return {
    apiUrl,
    authDir: resolve(PERF_ROOT, ".auth"),
    baseUrl,
    compareUrl: process.env.PERF_COMPARE_URL?.replace(/\/$/, "") || null,
    email,
    password,
    perfRoot: PERF_ROOT,
    resultsDir: resolve(PERF_ROOT, "results"),
    storageStatePath: resolve(PERF_ROOT, ".auth", "storageState.json"),
  };
}

export { PERF_ROOT };
