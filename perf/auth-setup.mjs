#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

import { getPerfConfig } from "./lib/env.mjs";

const config = getPerfConfig();
mkdirSync(config.authDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(`${config.baseUrl}/#login`, {
    timeout: 60_000,
    waitUntil: "networkidle",
  });

  await page
    .locator("#signin-email")
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("#signin-email").fill(config.email);
  await page.locator("#signin-password").fill(config.password);

  await Promise.all([
    page.waitForURL(/\/(today|onboarding)/, { timeout: 60_000 }),
    page.locator('#signin-form button[type="submit"]').click(),
  ]);

  const url = page.url();
  if (url.includes("/onboarding")) {
    throw new Error(
      "Harness account must complete avatar onboarding before perf runs. See docs/PERF_TESTING.md."
    );
  }

  await context.storageState({ path: config.storageStatePath });
  console.log(`Wrote storage state → ${config.storageStatePath}`);
  console.log(`Signed in as ${config.email} on ${config.baseUrl}`);
} finally {
  await browser.close();
}
