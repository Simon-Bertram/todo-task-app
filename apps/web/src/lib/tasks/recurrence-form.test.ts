import { describe, expect, it } from "vitest";
import {
  buildRecurrenceRule,
  parseRecurrenceRule,
  recurrenceSummary,
} from "./recurrence-form";

describe("parseRecurrenceRule", () => {
  it("parses simple presets", () => {
    expect(parseRecurrenceRule(null).mode).toBe("none");
    expect(parseRecurrenceRule("DAILY").mode).toBe("DAILY");
    expect(parseRecurrenceRule("WEEKDAYS").mode).toBe("WEEKDAYS");
    expect(parseRecurrenceRule("WEEKLY").mode).toBe("WEEKLY");
    expect(parseRecurrenceRule("MONTHLY").mode).toBe("MONTHLY");
  });

  it("parses weekly day lists and custom intervals", () => {
    expect(parseRecurrenceRule("WEEKLY:MON,FRI")).toMatchObject({
      mode: "WEEKLY_DAYS",
      weeklyDays: ["MON", "FRI"],
    });
    expect(parseRecurrenceRule("EVERY:5D")).toMatchObject({
      everyDays: 5,
      mode: "EVERY",
    });
  });
});

describe("buildRecurrenceRule", () => {
  it("round-trips custom weekly days and intervals", () => {
    expect(
      buildRecurrenceRule({
        everyDays: 3,
        mode: "WEEKLY_DAYS",
        weeklyDays: ["FRI", "MON"],
      })
    ).toBe("WEEKLY:MON,FRI");
    expect(
      buildRecurrenceRule({
        everyDays: 7,
        mode: "EVERY",
        weeklyDays: ["MON"],
      })
    ).toBe("EVERY:7D");
  });
});

describe("recurrenceSummary", () => {
  it("labels custom modes", () => {
    expect(
      recurrenceSummary({
        everyDays: 3,
        mode: "WEEKLY_DAYS",
        weeklyDays: ["MON", "WED"],
      })
    ).toBe("Weekly · Mon, Wed");
    expect(
      recurrenceSummary({
        everyDays: 4,
        mode: "EVERY",
        weeklyDays: ["MON"],
      })
    ).toBe("Every 4 days");
  });
});
