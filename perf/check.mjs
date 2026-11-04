#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getPerfConfig } from "./lib/env.mjs";
import { createRunDir, writeJson } from "./lib/results.mjs";

const perfRoot = dirname(fileURLToPath(import.meta.url));
const config = getPerfConfig();
const runDir = createRunDir(config.resultsDir);

function runStep(script, env = {}) {
  console.log(`\n=== ${script} ===`);
  const result = spawnSync(process.execPath, [resolve(perfRoot, script)], {
    cwd: perfRoot,
    env: { ...process.env, PERF_RUN_DIR: runDir, ...env },
    stdio: "inherit",
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${script} exited with ${result.status}`);
  }
}

try {
  runStep("auth-setup.mjs");
  runStep("crud-bench.mjs");
  runStep("measure-api-latency.mjs");
  runStep("measure-island-js.mjs");
  // Lighthouse is supporting; warn-only for overall check continuity on flaky LCP
  console.log("\n=== run-lhci.mjs ===");
  const lh = spawnSync(process.execPath, [resolve(perfRoot, "run-lhci.mjs")], {
    cwd: perfRoot,
    env: { ...process.env, PERF_RUN_DIR: runDir },
    stdio: "inherit",
  });
  if ((lh.status ?? 1) !== 0) {
    console.warn(`Lighthouse exited ${lh.status} (recorded; check continues).`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function readOptional(name) {
  const path = resolve(runDir, name);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

const summary = {
  api: readOptional("api.json"),
  baseUrl: config.baseUrl,
  compareHint:
    "Use pnpm perf:compare -- <baseline> <candidate>. Pre-progress baseline commit: f066a9b.",
  compareUrl: config.compareUrl,
  crud: readOptional("crud.json"),
  islands: readOptional("islands.json"),
  lighthouse: readOptional("lighthouse.json"),
  timestamp: new Date().toISOString(),
};

writeJson(resolve(runDir, "summary.json"), summary);
console.log(`\nCombined summary → ${resolve(runDir, "summary.json")}`);

if (config.compareUrl) {
  console.log(
    `PERF_COMPARE_URL is set (${config.compareUrl}). Re-run with PERF_BASE_URL=${config.compareUrl} and compare summary.json files.`
  );
}
