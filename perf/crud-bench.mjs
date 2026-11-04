#!/usr/bin/env node
import { resolve } from "node:path";
import { chromium } from "playwright";

import { cookieHeaderFromStorageState, hostsFromUrls } from "./lib/cookies.mjs";
import { getPerfConfig, PERF_PREFIX } from "./lib/env.mjs";
import { cleanupPerfTasks, seedPerfTasks } from "./lib/fixtures.mjs";
import { createPerfOrpcClient } from "./lib/orpc.mjs";
import { createRunDir, writeJson } from "./lib/results.mjs";

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
const scenarios = [];

function rpcUrlMatches(url, parts) {
  return url.includes("/rpc") && parts.some((part) => url.includes(part));
}

/**
 * Time click/input delay and RPC round-trip for a mutating action.
 * @param {import('playwright').Page} page
 * @param {string[]} pathIncludes
 * @param {() => Promise<void>} action
 */
async function measureRpcAround(page, pathIncludes, action) {
  const responsePromise = page.waitForResponse(
    (response) =>
      rpcUrlMatches(response.url(), pathIncludes) &&
      response.request().method() === "POST",
    { timeout: 60_000 }
  );

  const clickStarted = performance.now();
  await action();
  const inpOrClickDelayMs = Math.round(performance.now() - clickStarted);

  const response = await responsePromise;
  await response.finished();
  const rpcMs = Math.round(performance.now() - clickStarted);

  return {
    inpOrClickDelayMs,
    rpcMs,
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} name
 * @param {"short" | "long"} fixture
 * @param {() => Promise<{ rpcMs?: number | null, inpOrClickDelayMs?: number | null, reloadCount?: number }>} action
 */
async function runScenario(page, name, fixture, action) {
  let navigations = 0;
  const onNav = (frame) => {
    if (frame === page.mainFrame()) {
      navigations += 1;
    }
  };
  page.on("framenavigated", onNav);

  const wallStarted = performance.now();
  let actionMeta = {};
  try {
    actionMeta = (await action()) ?? {};
  } finally {
    page.off("framenavigated", onNav);
  }
  const settleMs = Math.round(performance.now() - wallStarted);

  const row = {
    fixture,
    inpOrClickDelayMs: actionMeta.inpOrClickDelayMs ?? null,
    name,
    reloadCount: actionMeta.reloadCount ?? Math.max(navigations - 1, 0),
    rpcMs: actionMeta.rpcMs ?? null,
    settleMs,
  };
  scenarios.push(row);
  console.log(
    `${name} [${fixture}] settle=${row.settleMs}ms rpc=${row.rpcMs ?? "n/a"}ms click=${row.inpOrClickDelayMs ?? "n/a"}ms reloads=${row.reloadCount}`
  );
  return row;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: config.storageStatePath,
  viewport: { height: 800, width: 1280 },
});
const page = await context.newPage();

try {
  console.log("Cleaning previous [perf] tasks…");
  await cleanupPerfTasks(orpc);

  console.log("Seeding short fixtures…");
  const shortTasks = await seedPerfTasks(orpc, "short", 5);
  await page.goto(`${config.baseUrl}/today`, {
    timeout: 60_000,
    waitUntil: "networkidle",
  });

  await runScenario(page, "create_quick_add", "short", async () => {
    const title = `${PERF_PREFIX} create short ${Date.now()}`;
    const rpc = await measureRpcAround(
      page,
      ["tasks/create", "tasks.create"],
      async () => {
        await page.getByTestId("quick-add-fab").click();
        await page.getByTestId("quick-add-title").fill(title);
        await page.getByTestId("quick-add-submit").click();
      }
    );
    await page.waitForLoadState("networkidle");
    return rpc;
  });

  const shortTarget = shortTasks[0];
  if (!shortTarget) {
    throw new Error("Failed to seed short tasks.");
  }

  await page.goto(`${config.baseUrl}/today`, {
    timeout: 60_000,
    waitUntil: "networkidle",
  });

  await runScenario(page, "update_sheet_save", "short", async () => {
    const rpc = await measureRpcAround(
      page,
      ["tasks/update", "tasks.update"],
      async () => {
        await page
          .locator(`[data-task-id="${shortTarget.id}"]`)
          .first()
          .click();
        await page
          .getByTestId("task-detail-title")
          .waitFor({ state: "visible" });
        await page
          .getByTestId("task-detail-title")
          .fill(`${shortTarget.title} edited`);
        await page.getByTestId("task-detail-save").click();
      }
    );
    await page.waitForLoadState("networkidle");
    return rpc;
  });

  await page.goto(`${config.baseUrl}/today`, {
    timeout: 60_000,
    waitUntil: "networkidle",
  });

  await runScenario(page, "complete_sheet_save", "short", async () => {
    const rpc = await measureRpcAround(
      page,
      ["tasks/update", "tasks.update"],
      async () => {
        await page
          .locator(`[data-task-id="${shortTarget.id}"]`)
          .first()
          .click();
        await page.getByTestId("task-detail-completed").check();
        await page.getByTestId("task-detail-save").click();
      }
    );
    await page.waitForLoadState("networkidle");
    return rpc;
  });

  await cleanupPerfTasks(orpc);

  console.log("Seeding long fixtures…");
  const longTasks = await seedPerfTasks(orpc, "long", 8);
  const longTarget = longTasks[0];
  if (!longTarget) {
    throw new Error("Failed to seed long tasks.");
  }

  await page.goto(`${config.baseUrl}/today`, {
    timeout: 60_000,
    waitUntil: "networkidle",
  });

  await runScenario(page, "create_quick_add", "long", async () => {
    const title = `${PERF_PREFIX} create long ${Date.now()}`;
    const rpc = await measureRpcAround(
      page,
      ["tasks/create", "tasks.create"],
      async () => {
        await page.getByTestId("quick-add-fab").click();
        await page.getByTestId("quick-add-title").fill(title);
        await page.getByTestId("quick-add-submit").click();
      }
    );
    await page.waitForLoadState("networkidle");
    return rpc;
  });

  await page.goto(`${config.baseUrl}/today`, {
    timeout: 60_000,
    waitUntil: "networkidle",
  });

  await runScenario(page, "progress_pie_commit", "long", async () => {
    const card = page.locator(`[data-task-id="${longTarget.id}"]`).first();
    const inlineProgress = page
      .locator(`li:has([data-task-id="${longTarget.id}"])`)
      .getByRole("button", { name: /Set progress to 50 percent/i });

    if ((await inlineProgress.count()) > 0) {
      return measureRpcAround(
        page,
        ["tasks/update", "tasks.update"],
        async () => {
          await inlineProgress.first().click();
        }
      );
    }

    return measureRpcAround(
      page,
      ["tasks/update", "tasks.update"],
      async () => {
        await card.click();
        await page
          .getByRole("button", { name: /Set progress to 50 percent/i })
          .click();
      }
    );
  });

  const offToday = await orpc.tasks.create({
    estimatedMinutes: 90,
    isToday: false,
    title: `${PERF_PREFIX} long off-today ${Date.now()}`,
  });

  await page.goto(`${config.baseUrl}/matrix`, {
    timeout: 60_000,
    waitUntil: "networkidle",
  });

  await runScenario(page, "add_to_today_sheet", "long", async () => {
    const rpc = await measureRpcAround(
      page,
      ["tasks/update", "tasks.update"],
      async () => {
        await page.locator(`[data-task-id="${offToday.id}"]`).first().click();
        await page.getByTestId("task-detail-add-today").click();
      }
    );
    await page.waitForLoadState("networkidle");
    return rpc;
  });

  await page.goto(`${config.baseUrl}/today`, {
    timeout: 60_000,
    waitUntil: "networkidle",
  });

  const longForUpdate = (await orpc.tasks.list({})).find((task) =>
    task.title.startsWith(`${PERF_PREFIX} long`)
  );

  if (longForUpdate) {
    await runScenario(page, "update_sheet_save", "long", async () => {
      const rpc = await measureRpcAround(
        page,
        ["tasks/update", "tasks.update"],
        async () => {
          await page
            .locator(`[data-task-id="${longForUpdate.id}"]`)
            .first()
            .click();
          await page
            .getByTestId("task-detail-title")
            .fill(`${longForUpdate.title} edited`);
          await page.getByTestId("task-detail-save").click();
        }
      );
      await page.waitForLoadState("networkidle");
      return rpc;
    });
  }
} finally {
  console.log("Cleaning [perf] tasks…");
  try {
    await cleanupPerfTasks(orpc);
  } catch (error) {
    console.warn("Cleanup failed:", error);
  }
  await browser.close();
}

const summary = {
  baseUrl: config.baseUrl,
  commitHint: "Compare against baseline f066a9b (pre-3880c09) when available",
  kind: "crud",
  scenarios,
  timestamp: new Date().toISOString(),
};

const crudPath = resolve(runDir, "crud.json");
const summaryPath = resolve(runDir, "summary.json");
writeJson(crudPath, summary);
writeJson(summaryPath, {
  api: null,
  crud: summary,
  islands: null,
  lighthouse: null,
});

console.log(`Wrote ${crudPath}`);
console.log(`Run directory → ${runDir}`);

// Expose for check.mjs chaining via env
console.log(`PERF_RUN_DIR=${runDir}`);
