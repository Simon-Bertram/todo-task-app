#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cookieHeaderFromStorageState, hostsFromUrls } from "./lib/cookies.mjs";
import { getPerfConfig } from "./lib/env.mjs";
import { createRunDir, writeJson } from "./lib/results.mjs";

const config = getPerfConfig();
const runDir = process.env.PERF_RUN_DIR
  ? process.env.PERF_RUN_DIR
  : createRunDir(config.resultsDir);

const cookieHeader = cookieHeaderFromStorageState(
  config.storageStatePath,
  hostsFromUrls(config.baseUrl, config.apiUrl)
);

const perfRoot = dirname(fileURLToPath(import.meta.url));

const env = {
  ...process.env,
  PERF_BASE_URL: config.baseUrl,
  PERF_COOKIE_HEADER: cookieHeader,
};

console.log(`Running LHCI against ${config.baseUrl}…`);
const result = spawnSync(
  "pnpm",
  ["exec", "lhci", "autorun", "--config=./lighthouserc.cjs"],
  {
    cwd: perfRoot,
    env,
    stdio: "inherit",
  }
);

const lhDir = resolve(perfRoot, ".lighthouseci");
const lhrFiles = existsSync(lhDir)
  ? readdirSync(lhDir).filter(
      (name) => name.startsWith("lhr-") && name.endsWith(".json")
    )
  : [];

const runs = [];
for (const file of lhrFiles) {
  try {
    const lhr = JSON.parse(readFileSync(resolve(lhDir, file), "utf8"));
    runs.push({
      cls: lhr.audits?.["cumulative-layout-shift"]?.numericValue ?? null,
      file,
      finalUrl: lhr.finalUrl,
      lcp: lhr.audits?.["largest-contentful-paint"]?.numericValue ?? null,
      performanceScore: lhr.categories?.performance?.score ?? null,
      tbt: lhr.audits?.["total-blocking-time"]?.numericValue ?? null,
    });
  } catch {
    // skip corrupt
  }
}

const lighthouse = {
  baseUrl: config.baseUrl,
  exitCode: result.status ?? 1,
  kind: "lighthouse",
  runs,
  timestamp: new Date().toISOString(),
};

writeJson(resolve(runDir, "lighthouse.json"), lighthouse);
console.log(`Wrote ${resolve(runDir, "lighthouse.json")}`);
console.log(`PERF_RUN_DIR=${runDir}`);

process.exitCode = result.status ?? 1;
