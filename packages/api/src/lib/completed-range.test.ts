import { describe, expect, it } from "vitest";

import { completedRangeBounds } from "./completed-range";

describe("completedRangeBounds", () => {
  const tz = "America/New_York";

  it("this_week spans Monday through end of today", () => {
    // Wednesday 2026-11-04 15:00 ET
    const now = new Date("2026-11-04T20:00:00.000Z");
    const bounds = completedRangeBounds("this_week", tz, now);
    expect(bounds.startMs).not.toBeNull();
    expect(bounds.endMs).not.toBeNull();
    if (bounds.startMs === null || bounds.endMs === null) {
      return;
    }
    expect(bounds.startMs < bounds.endMs).toBe(true);
    // Monday 2026-11-02 00:00 EST (DST ended Nov 1) = 05:00Z
    expect(new Date(bounds.startMs).toISOString()).toBe(
      "2026-11-02T05:00:00.000Z"
    );
  });

  it("last_week is previous Mon–Fri only", () => {
    const now = new Date("2026-11-04T20:00:00.000Z");
    const bounds = completedRangeBounds("last_week", tz, now);
    expect(bounds.startMs).not.toBeNull();
    expect(bounds.endMs).not.toBeNull();
    if (bounds.startMs === null || bounds.endMs === null) {
      return;
    }
    expect(new Date(bounds.startMs).toISOString()).toBe(
      "2026-10-26T04:00:00.000Z"
    );
    // Friday end — EDT still in late Oct
    expect(new Date(bounds.endMs).toISOString()).toBe(
      "2026-10-31T03:59:59.999Z"
    );
  });

  it("last_month is previous calendar month", () => {
    const now = new Date("2026-11-04T20:00:00.000Z");
    const bounds = completedRangeBounds("last_month", tz, now);
    expect(bounds.startMs).not.toBeNull();
    expect(bounds.endMs).not.toBeNull();
    if (bounds.startMs === null || bounds.endMs === null) {
      return;
    }
    expect(new Date(bounds.startMs).toISOString()).toBe(
      "2026-10-01T04:00:00.000Z"
    );
    expect(new Date(bounds.endMs).toISOString()).toBe(
      "2026-11-01T03:59:59.999Z"
    );
  });

  it("last_year is previous calendar year", () => {
    const now = new Date("2026-11-04T20:00:00.000Z");
    const bounds = completedRangeBounds("last_year", tz, now);
    expect(bounds.startMs).not.toBeNull();
    expect(bounds.endMs).not.toBeNull();
    if (bounds.startMs === null || bounds.endMs === null) {
      return;
    }
    expect(new Date(bounds.startMs).toISOString()).toBe(
      "2025-01-01T05:00:00.000Z"
    );
    expect(new Date(bounds.endMs).toISOString()).toBe(
      "2026-01-01T04:59:59.999Z"
    );
  });

  it("all has no bounds", () => {
    expect(completedRangeBounds("all", tz)).toEqual({
      endMs: null,
      startMs: null,
    });
  });
});
