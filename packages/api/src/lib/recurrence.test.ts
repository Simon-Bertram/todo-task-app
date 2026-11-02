import { describe, expect, it } from "vitest";

import { nextDueDateForRecurrence } from "./recurrence";

describe("nextDueDateForRecurrence", () => {
  it("advances daily and weekdays", () => {
    expect(nextDueDateForRecurrence("DAILY", "2026-11-02")).toBe("2026-11-03");
    // Friday -> Monday
    expect(nextDueDateForRecurrence("WEEKDAYS", "2026-11-06")).toBe(
      "2026-11-09"
    );
  });

  it("handles weekly variants and monthly", () => {
    expect(nextDueDateForRecurrence("WEEKLY", "2026-11-02")).toBe("2026-11-09");
    expect(nextDueDateForRecurrence("WEEKLY:MON,FRI", "2026-11-02")).toBe(
      "2026-11-06"
    );
    expect(nextDueDateForRecurrence("MONTHLY", "2026-01-15")).toBe(
      "2026-02-15"
    );
  });

  it("supports EVERY:Xd custom interval", () => {
    expect(nextDueDateForRecurrence("EVERY:3D", "2026-11-02")).toBe(
      "2026-11-05"
    );
  });

  it("returns null for missing or unknown rules", () => {
    expect(nextDueDateForRecurrence(null, "2026-11-02")).toBeNull();
    expect(nextDueDateForRecurrence("CRON", "2026-11-02")).toBeNull();
  });
});
