import { describe, expect, it } from "vitest";

import {
  capacityTone,
  formatMinutes,
  getCapacityBucket,
  getQuadrant,
} from "./quadrant";

describe("getQuadrant", () => {
  it("uses threshold >= 2 for urgent and important", () => {
    expect(getQuadrant(2, 2)).toBe("Q1");
    expect(getQuadrant(3, 2)).toBe("Q1");
    expect(getQuadrant(1, 2)).toBe("Q2");
    expect(getQuadrant(0, 3)).toBe("Q2");
    expect(getQuadrant(2, 1)).toBe("Q3");
    expect(getQuadrant(3, 0)).toBe("Q3");
    expect(getQuadrant(1, 1)).toBe("Q4");
    expect(getQuadrant(0, 0)).toBe("Q4");
  });
});

describe("getCapacityBucket", () => {
  it("maps estimated minutes into 1-3-5 style buckets", () => {
    expect(getCapacityBucket(90)).toBe("major");
    expect(getCapacityBucket(60)).toBe("major");
    expect(getCapacityBucket(120)).toBe("major");
    expect(getCapacityBucket(45)).toBe("medium");
    expect(getCapacityBucket(30)).toBe("medium");
    expect(getCapacityBucket(10)).toBe("quick");
    expect(getCapacityBucket(15)).toBe("quick");
    expect(getCapacityBucket(20)).toBe("medium");
    expect(getCapacityBucket(150)).toBe("major");
  });
});

describe("formatMinutes", () => {
  it("formats whole hours, mixed durations, and minutes", () => {
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(45)).toBe("45m");
  });
});

describe("capacityTone", () => {
  it("returns ok under 75%, warn at 75–100%, over above capacity", () => {
    expect(capacityTone(224, 300)).toBe("ok");
    expect(capacityTone(225, 300)).toBe("warn");
    expect(capacityTone(300, 300)).toBe("warn");
    expect(capacityTone(301, 300)).toBe("over");
  });
});
