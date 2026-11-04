import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function createRunDir(resultsDir) {
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const dir = resolve(resultsDir, stamp);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeJson(filePath, data) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function percentile(sortedValues, p) {
  if (sortedValues.length === 0) {
    return null;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1)
  );
  return sortedValues[index];
}

export function summarizeDurations(values) {
  const sorted = [...values]
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  return {
    count: sorted.length,
    max: sorted.length ? sorted.at(-1) : null,
    min: sorted.length ? sorted[0] : null,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
  };
}
