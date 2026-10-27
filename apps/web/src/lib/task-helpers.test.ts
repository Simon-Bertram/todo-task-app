import { describe, expect, it } from "vitest";

import {
  getProject,
  getTasksByQuadrant,
  getTodayByBucket,
  getTodayPlannedMinutes,
  getTodayTasks,
  type Project,
  type Task,
} from "./task-helpers";

function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    dueDate: null,
    estimatedMinutes: 30,
    isCompleted: false,
    isImportant: 0,
    isToday: false,
    isUrgent: 0,
    notes: null,
    projectId: null,
    recurrenceRule: null,
    sortOrder: 0,
    ...overrides,
  };
}

describe("getProject", () => {
  const projects: Project[] = [
    { color: "#111", id: "p1", name: "Alpha" },
    { color: "#222", id: "p2", name: "Beta" },
  ];

  it("returns null when projectId is null or unknown", () => {
    expect(getProject(projects, null)).toBeNull();
    expect(getProject(projects, "missing")).toBeNull();
  });

  it("returns the matching project", () => {
    expect(getProject(projects, "p2")).toEqual(projects[1]);
  });
});

describe("getTodayTasks", () => {
  it("filters to incomplete today tasks ordered by sortOrder", () => {
    const tasks = [
      makeTask({ id: "1", isToday: true, sortOrder: 2, title: "Later" }),
      makeTask({ id: "2", isToday: true, sortOrder: 1, title: "Soon" }),
      makeTask({ id: "3", isToday: false, title: "Backlog" }),
      makeTask({
        id: "4",
        isCompleted: true,
        isToday: true,
        title: "Done today",
      }),
    ];

    expect(getTodayTasks(tasks).map((task) => task.id)).toEqual(["2", "1"]);
  });
});

describe("getTodayPlannedMinutes", () => {
  it("sums estimated minutes for today's incomplete tasks", () => {
    const tasks = [
      makeTask({
        estimatedMinutes: 45,
        id: "1",
        isToday: true,
        title: "A",
      }),
      makeTask({
        estimatedMinutes: 15,
        id: "2",
        isToday: true,
        title: "B",
      }),
      makeTask({
        estimatedMinutes: 60,
        id: "3",
        isCompleted: true,
        isToday: true,
        title: "C",
      }),
    ];

    expect(getTodayPlannedMinutes(tasks)).toBe(60);
  });
});

describe("getTasksByQuadrant", () => {
  it("buckets incomplete tasks by Eisenhower quadrant", () => {
    const tasks = [
      makeTask({ id: "q1", isImportant: 2, isUrgent: 2, title: "Crisis" }),
      makeTask({ id: "q2", isImportant: 3, isUrgent: 1, title: "Strategy" }),
      makeTask({ id: "q3", isImportant: 0, isUrgent: 3, title: "Interrupt" }),
      makeTask({ id: "q4", isImportant: 1, isUrgent: 1, title: "Noise" }),
      makeTask({
        id: "done",
        isCompleted: true,
        isImportant: 2,
        isUrgent: 2,
        title: "Done",
      }),
    ];

    const buckets = getTasksByQuadrant(tasks);
    expect(buckets.Q1.map((task) => task.id)).toEqual(["q1"]);
    expect(buckets.Q2.map((task) => task.id)).toEqual(["q2"]);
    expect(buckets.Q3.map((task) => task.id)).toEqual(["q3"]);
    expect(buckets.Q4.map((task) => task.id)).toEqual(["q4"]);
  });
});

describe("getTodayByBucket", () => {
  it("groups today's tasks by capacity bucket", () => {
    const tasks = [
      makeTask({
        estimatedMinutes: 90,
        id: "major",
        isToday: true,
        title: "Major",
      }),
      makeTask({
        estimatedMinutes: 40,
        id: "medium",
        isToday: true,
        title: "Medium",
      }),
      makeTask({
        estimatedMinutes: 10,
        id: "quick",
        isToday: true,
        title: "Quick",
      }),
      makeTask({
        estimatedMinutes: 20,
        id: "other",
        isToday: true,
        title: "Other band",
      }),
    ];

    const groups = getTodayByBucket(tasks);
    expect(groups.major.map((task) => task.id)).toEqual(["major"]);
    expect(groups.medium.map((task) => task.id)).toEqual(["medium", "other"]);
    expect(groups.quick.map((task) => task.id)).toEqual(["quick"]);
    expect(groups.other).toEqual([]);
  });
});
