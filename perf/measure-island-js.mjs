#!/usr/bin/env node
import { resolve } from "node:path";
import { chromium } from "playwright";

import { getPerfConfig } from "./lib/env.mjs";
import { createRunDir, writeJson } from "./lib/results.mjs";

const ISLAND_BUDGET_BYTES = 35 * 1024;

const config = getPerfConfig();
const runDir = process.env.PERF_RUN_DIR
  ? process.env.PERF_RUN_DIR
  : createRunDir(config.resultsDir);

const pages = [
  { path: "/", public: true },
  { path: "/today", public: false },
  { path: "/matrix", public: false },
  { path: "/projects", public: false },
];

function isIslandScript(url) {
  try {
    const { pathname } = new URL(url);
    if (!(pathname.endsWith(".js") || pathname.endsWith(".mjs"))) {
      return false;
    }
    return (
      pathname.includes("/_astro/") ||
      pathname.includes("island") ||
      pathname.includes("preact") ||
      pathname.includes("task-progress") ||
      pathname.includes("gsap") ||
      pathname.includes("client")
    );
  } catch {
    return false;
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: config.storageStatePath,
});

/** @type {Array<object>} */
const pageReports = [];
let failed = false;

try {
  for (const entry of pages) {
    const page = await context.newPage();
    /** @type {Map<string, { transferSize: number, url: string }>} */
    const scripts = new Map();

    page.on("response", async (response) => {
      const url = response.url();
      if (!isIslandScript(url)) {
        return;
      }
      try {
        const body = await response.body();
        // Transfer size approximation: encoded body length when compressed by CF
        const headers = response.headers();
        const contentLength = Number(headers["content-length"]);
        const transferSize = Number.isFinite(contentLength)
          ? contentLength
          : body.byteLength;
        scripts.set(url, { transferSize, url });
      } catch {
        // Ignore aborted bodies
      }
    });

    await page.goto(`${config.baseUrl}${entry.path}`, {
      timeout: 90_000,
      waitUntil: "networkidle",
    });

    // Resource Timing transferSize is more accurate when available
    const timing = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((entry) => entry.initiatorType === "script")
        .map((entry) => ({
          encodedBodySize: entry.encodedBodySize,
          name: entry.name,
          transferSize: entry.transferSize,
        }))
    );

    for (const item of timing) {
      if (!isIslandScript(item.name)) {
        continue;
      }
      const size =
        item.transferSize > 0
          ? item.transferSize
          : item.encodedBodySize > 0
            ? item.encodedBodySize
            : (scripts.get(item.name)?.transferSize ?? 0);
      scripts.set(item.name, { transferSize: size, url: item.name });
    }

    const scriptList = [...scripts.values()];
    const totalBytes = scriptList.reduce((sum, s) => sum + s.transferSize, 0);
    const ok = totalBytes <= ISLAND_BUDGET_BYTES;
    if (!(ok || entry.public)) {
      failed = true;
    }

    const report = {
      budgetBytes: ISLAND_BUDGET_BYTES,
      ok: entry.public ? true : ok,
      path: entry.path,
      scripts: scriptList.sort((a, b) => b.transferSize - a.transferSize),
      totalBytes,
      totalKb: Number((totalBytes / 1024).toFixed(2)),
    };
    pageReports.push(report);
    console.log(
      `${entry.path}: ${report.totalKb}KB island-ish scripts (budget ${ISLAND_BUDGET_BYTES / 1024}KB) ${report.ok ? "OK" : "FAIL"}`
    );
    await page.close();
  }
} finally {
  await browser.close();
}

const islands = {
  baseUrl: config.baseUrl,
  budgetBytes: ISLAND_BUDGET_BYTES,
  kind: "islands",
  pages: pageReports,
  timestamp: new Date().toISOString(),
};

writeJson(resolve(runDir, "islands.json"), islands);
console.log(`Wrote ${resolve(runDir, "islands.json")}`);
console.log(`PERF_RUN_DIR=${runDir}`);

if (failed) {
  process.exitCode = 1;
}
