"use strict";
/**
 * LHCI config. Cookie header injected at runtime by run-lhci.mjs via env.
 * @type {import('@lhci/cli').Config}
 */
const baseUrl = (process.env.PERF_BASE_URL || "https://todo.sarl").replace(
  /\/$/,
  ""
);
const cookie = process.env.PERF_COOKIE_HEADER || "";

const extraHeaders = cookie
  ? {
      Cookie: cookie,
    }
  : {};

module.exports = {
  ci: {
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.7 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.1 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 1200 }],
        "total-blocking-time": ["warn", { maxNumericValue: 600 }],
      },
    },
    collect: {
      numberOfRuns: 3,
      settings: {
        emulatedFormFactor: "mobile",
        extraHeaders,
        throttling: {
          cpuSlowdownMultiplier: 4,
          downloadThroughputKbps: 1.6 * 1024,
          requestLatencyMs: 150,
          rttMs: 150,
          uploadThroughputKbps: 750,
        },
        throttlingMethod: "simulate",
      },
      url: [
        `${baseUrl}/`,
        `${baseUrl}/today`,
        `${baseUrl}/matrix`,
        `${baseUrl}/projects`,
      ],
    },
    upload: {
      outputDir: "./.lighthouseci",
      target: "filesystem",
    },
  },
};
