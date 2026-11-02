import { describe, expect, it } from "vitest";

import {
  buildMonthGrid,
  countDueReminders,
  daysBetween,
  formatDateOnly,
  getDueReminderLabel,
  getDueReminderStatus,
  parseDateOnly,
} from "./due-date";

describe("parseDateOnly / formatDateOnly", () => {
  it("round-trips a valid date", () => {
    const parsed = parseDateOnly("2026-11-02");
    expect(parsed).not.toBeNull();
    expect(formatDateOnly(parsed as Date)).toBe("2026-11-02");
  });

  it("rejects invalid dates", () => {
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("11/02/2026")).toBeNull();
  });
});

describe("getDueReminderStatus", () => {
  const today = "2026-11-02";

  it("classifies overdue, today, soon, and upcoming", () => {
    expect(getDueReminderStatus("2026-10-31", today)).toBe("overdue");
    expect(getDueReminderStatus("2026-11-02", today)).toBe("today");
    expect(getDueReminderStatus("2026-11-03", today)).toBe("soon");
    expect(getDueReminderStatus("2026-11-04", today)).toBe("soon");
    expect(getDueReminderStatus("2026-11-05", today)).toBe("upcoming");
    expect(getDueReminderStatus(null, today)).toBe("none");
  });
});

describe("getDueReminderLabel", () => {
  it("returns reminder copy for near-due statuses", () => {
    expect(getDueReminderLabel("overdue", "2026-11-01", "2026-11-02")).toBe(
      "Overdue by 1 day"
    );
    expect(getDueReminderLabel("today", "2026-11-02", "2026-11-02")).toBe(
      "Due today"
    );
    expect(getDueReminderLabel("soon", "2026-11-04", "2026-11-02")).toBe(
      "Due in 2 days"
    );
    expect(getDueReminderLabel("upcoming", "2026-11-10", "2026-11-02")).toBe(
      null
    );
  });
});

describe("daysBetween / countDueReminders / buildMonthGrid", () => {
  it("counts day deltas", () => {
    expect(daysBetween("2026-11-02", "2026-11-04")).toBe(2);
  });

  it("counts reminder buckets", () => {
    const counts = countDueReminders(
      [
        { dueDate: "2026-10-01", isCompleted: false },
        { dueDate: "2026-11-02", isCompleted: false },
        { dueDate: "2026-11-03", isCompleted: false },
        { dueDate: "2026-11-03", isCompleted: true },
        { dueDate: null, isCompleted: false },
      ],
      "2026-11-02"
    );
    expect(counts).toEqual({ overdue: 1, soon: 1, today: 1 });
  });

  it("builds a month grid starting Sunday", () => {
    // November 2026 starts on Sunday
    const grid = buildMonthGrid(2026, 10);
    expect(grid[0]?.getDate()).toBe(1);
    expect(grid.filter(Boolean)).toHaveLength(30);
  });
});
