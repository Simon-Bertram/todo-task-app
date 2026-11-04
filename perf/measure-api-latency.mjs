#!/usr/bin/env node
import { resolve } from "node:path";

import { cookieHeaderFromStorageState, hostsFromUrls } from "./lib/cookies.mjs";
import { getPerfConfig, PERF_PREFIX } from "./lib/env.mjs";
import { cleanupPerfTasks } from "./lib/fixtures.mjs";
import { createPerfOrpcClient, timedCall } from "./lib/orpc.mjs";
import { createRunDir, summarizeDurations, writeJson } from "./lib/results.mjs";

const ITERATIONS = 20;
const CLIENT_P50_WARN_MS = 150;

const config = getPerfConfig();
const cookieHeader = cookieHeaderFromStorageState(
  config.storageStatePath,
  hostsFromUrls(config.baseUrl, config.apiUrl)
);
const orpc = createPerfOrpcClient({
  apiUrl: config.apiUrl,
  cookieHeader,
});

const runDir = process.env.PERF_RUN_DIR
  ? process.env.PERF_RUN_DIR
  : createRunDir(config.resultsDir);

await cleanupPerfTasks(orpc);

const seed = await orpc.tasks.create({
  estimatedMinutes: 90,
  isToday: true,
  progressPercent: 10,
  title: `${PERF_PREFIX} api-latency seed`,
});

/** @type {Record<string, number[]>} */
const samples = {
  "tasks.create": [],
  "tasks.list": [],
  "tasks.update.complete": [],
  "tasks.update.progress": [],
};

try {
  for (let i = 0; i < ITERATIONS; i += 1) {
    const list = await timedCall("tasks.list", () => orpc.tasks.list({}));
    samples["tasks.list"].push(list.ms);

    const created = await timedCall("tasks.create", () =>
      orpc.tasks.create({
        estimatedMinutes: 30,
        title: `${PERF_PREFIX} api create ${i}`,
      })
    );
    samples["tasks.create"].push(created.ms);

    const progress = await timedCall("tasks.update.progress", () =>
      orpc.tasks.update({
        id: seed.id,
        progressPercent: 25 + (i % 50),
      })
    );
    samples["tasks.update.progress"].push(progress.ms);

    const complete = await timedCall("tasks.update.complete", () =>
      orpc.tasks.update({
        id: created.result.id,
        isCompleted: true,
        timeZone: "UTC",
      })
    );
    samples["tasks.update.complete"].push(complete.ms);

    await orpc.tasks.delete({ id: created.result.id });
  }
} finally {
  await cleanupPerfTasks(orpc);
}

const procedures = Object.fromEntries(
  Object.entries(samples).map(([name, values]) => [
    name,
    summarizeDurations(values),
  ])
);

const warnings = [];
for (const [name, stats] of Object.entries(procedures)) {
  if (stats.p50 !== null && stats.p50 > CLIENT_P50_WARN_MS) {
    warnings.push(
      `${name} client p50 ${Math.round(stats.p50)}ms > ${CLIENT_P50_WARN_MS}ms (proxy; D1 PRD target is 30ms server-side)`
    );
  }
}

const report = {
  apiUrl: config.apiUrl,
  kind: "api",
  note: "Client RTT includes network + Worker + D1. Use Cloudflare observability for true D1 median < 30ms.",
  procedures,
  timestamp: new Date().toISOString(),
  warnClientP50Ms: CLIENT_P50_WARN_MS,
  warnings,
};

writeJson(resolve(runDir, "api.json"), report);

for (const [name, stats] of Object.entries(procedures)) {
  console.log(
    `${name}: p50=${stats.p50?.toFixed?.(1) ?? stats.p50}ms p95=${stats.p95?.toFixed?.(1) ?? stats.p95}ms n=${stats.count}`
  );
}
for (const warning of warnings) {
  console.warn(`WARN: ${warning}`);
}
console.log(`Wrote ${resolve(runDir, "api.json")}`);
console.log(`PERF_RUN_DIR=${runDir}`);
