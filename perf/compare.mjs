#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Compare two summary/crud/api/islands/lighthouse JSON artifacts.
 * Usage: node compare.mjs <baseline.json> <candidate.json>
 *
 * Accepts either summary.json or crud.json (and optional sibling files).
 */

const SETTLE_ABS_MS = 100;
const SETTLE_REL = 0.15;
const ISLAND_ABS_BYTES = 2 * 1024;
const LCP_ABS_MS = 100;
const API_P50_ABS_MS = 25;

function loadJson(path) {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function asSummary(data, path) {
  if (data.crud || data.api || data.islands || data.lighthouse) {
    return data;
  }
  if (data.kind === "crud" || data.scenarios) {
    return { crud: data };
  }
  if (data.kind === "api" || data.procedures) {
    return { api: data };
  }
  if (data.kind === "islands" || data.pages) {
    return { islands: data };
  }
  if (data.kind === "lighthouse" || data.runs) {
    return { lighthouse: data };
  }
  throw new Error(`Unrecognized result shape: ${path}`);
}

function scenarioKey(scenario) {
  return `${scenario.name}::${scenario.fixture}`;
}

function avgSettle(scenarios, name, fixture) {
  const rows = scenarios.filter(
    (s) => s.name === name && s.fixture === fixture
  );
  if (rows.length === 0) {
    return null;
  }
  return rows.reduce((sum, s) => sum + s.settleMs, 0) / rows.length;
}

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const baselinePath = args[0];
const candidatePath = args[1];

if (!(baselinePath && candidatePath)) {
  console.error(
    "Usage: pnpm perf:compare <baseline.json> <candidate.json>\n" +
      "Baseline tip: pre-progress commit f066a9b (before 3880c09)."
  );
  process.exit(1);
}

const baseline = asSummary(loadJson(resolve(baselinePath)), baselinePath);
const candidate = asSummary(loadJson(resolve(candidatePath)), candidatePath);

const failures = [];
const notes = [];

if (baseline.crud?.scenarios && candidate.crud?.scenarios) {
  const keys = new Set([
    ...baseline.crud.scenarios.map(scenarioKey),
    ...candidate.crud.scenarios.map(scenarioKey),
  ]);
  for (const key of keys) {
    const [name, fixture] = key.split("::");
    const base = avgSettle(baseline.crud.scenarios, name, fixture);
    const next = avgSettle(candidate.crud.scenarios, name, fixture);
    if (base === null || next === null) {
      notes.push(
        `CRUD ${key}: missing on one side (base=${base} next=${next})`
      );
      continue;
    }
    const delta = next - base;
    const rel = base === 0 ? 0 : delta / base;
    const line = `CRUD ${key}: ${Math.round(base)}ms → ${Math.round(next)}ms (Δ ${Math.round(delta)}ms, ${(rel * 100).toFixed(1)}%)`;
    console.log(line);
    if (delta > SETTLE_ABS_MS && rel > SETTLE_REL) {
      failures.push(line);
    }
  }
}

if (baseline.islands?.pages && candidate.islands?.pages) {
  for (const basePage of baseline.islands.pages) {
    const nextPage = candidate.islands.pages.find(
      (p) => p.path === basePage.path
    );
    if (!nextPage) {
      continue;
    }
    const delta = nextPage.totalBytes - basePage.totalBytes;
    const line = `Islands ${basePage.path}: ${basePage.totalKb}KB → ${nextPage.totalKb}KB (Δ ${delta} bytes)`;
    console.log(line);
    if (delta > ISLAND_ABS_BYTES) {
      failures.push(line);
    }
  }
}

if (baseline.api?.procedures && candidate.api?.procedures) {
  for (const name of Object.keys(baseline.api.procedures)) {
    const base = baseline.api.procedures[name]?.p50;
    const next = candidate.api.procedures[name]?.p50;
    if (base == null || next == null) {
      continue;
    }
    const delta = next - base;
    const line = `API ${name} p50: ${Math.round(base)}ms → ${Math.round(next)}ms (Δ ${Math.round(delta)}ms)`;
    console.log(line);
    if (delta > API_P50_ABS_MS) {
      failures.push(line);
    }
  }
}

if (baseline.lighthouse?.runs && candidate.lighthouse?.runs) {
  const avgLcp = (runs, urlPart) => {
    const matched = runs.filter(
      (r) => r.finalUrl?.includes(urlPart) && r.lcp != null
    );
    if (matched.length === 0) {
      return null;
    }
    return matched.reduce((sum, r) => sum + r.lcp, 0) / matched.length;
  };
  for (const path of ["/today", "/matrix", "/projects"]) {
    const base = avgLcp(baseline.lighthouse.runs, path);
    const next = avgLcp(candidate.lighthouse.runs, path);
    if (base == null || next == null) {
      continue;
    }
    const delta = next - base;
    const line = `LCP ${path}: ${Math.round(base)}ms → ${Math.round(next)}ms (Δ ${Math.round(delta)}ms)`;
    console.log(line);
    if (delta > LCP_ABS_MS) {
      failures.push(line);
    }
  }
}

for (const note of notes) {
  console.log(`NOTE: ${note}`);
}

if (failures.length > 0) {
  console.error("\nRegressions detected:");
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  console.error(
    "\nThresholds: CRUD settle +100ms and +15%; islands +2KB; API p50 +25ms; LCP +100ms."
  );
  process.exitCode = 1;
} else {
  console.log("\nNo regressions beyond thresholds.");
}
