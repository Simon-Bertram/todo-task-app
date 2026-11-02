import { DEFAULT_TASKS_BOARD_PREFS } from "@todo-task-app/api/schemas/tasks-board-prefs";
import { describe, expect, it } from "vitest";

import {
  filterTasksList,
  getLocalDateString,
  getProject,
  getTasksByQuadrant,
  getTodayByBucket,
  getTodayPlannedMinutes,
  getTodayTasks,
  hasActiveTasksBoardFilters,
  matchesDueDateFilter,
  mergeTasksBoardPrefs,
  type Project,
  prefsToSearchParams,
  sortTasksList,
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

describe("getLocalDateString", () => {
  it("formats a local calendar date as YYYY-MM-DD", () => {
    expect(getLocalDateString(new Date(2026, 10, 2))).toBe("2026-11-02");
  });
});

describe("matchesDueDateFilter", () => {
  const today = "2026-11-02";

  it("matches overdue, today, upcoming, and none buckets", () => {
    const overdue = makeTask({ dueDate: "2026-11-01", id: "1", title: "A" });
    const dueToday = makeTask({ dueDate: "2026-11-02", id: "2", title: "B" });
    const upcoming = makeTask({ dueDate: "2026-11-05", id: "3", title: "C" });
    const none = makeTask({ dueDate: null, id: "4", title: "D" });

    expect(matchesDueDateFilter(overdue, "overdue", today)).toBe(true);
    expect(matchesDueDateFilter(dueToday, "today", today)).toBe(true);
    expect(matchesDueDateFilter(upcoming, "upcoming", today)).toBe(true);
    expect(matchesDueDateFilter(none, "none", today)).toBe(true);
    expect(matchesDueDateFilter(none, "today", today)).toBe(false);
  });
});

describe("filterTasksList and sortTasksList", () => {
  const projects: Project[] = [
    { color: "#111", id: "p1", name: "Alpha" },
    { color: "#222", id: "p2", name: "Beta" },
  ];

  const tasks = [
    makeTask({
      dueDate: "2026-11-01",
      id: "1",
      isImportant: 3,
      isUrgent: 1,
      projectId: "p1",
      title: "Zebra crisis",
    }),
    makeTask({
      dueDate: "2026-11-05",
      id: "2",
      isImportant: 1,
      isUrgent: 3,
      projectId: "p2",
      title: "Alpha follow-up",
    }),
    makeTask({
      dueDate: null,
      id: "3",
      isImportant: 0,
      isUrgent: 0,
      projectId: null,
      title: "Inbox note",
    }),
    makeTask({
      id: "4",
      isCompleted: true,
      projectId: "p1",
      title: "Done Alpha",
    }),
  ];

  it("filters by project, due, priority, and search including project name", () => {
    const filtered = filterTasksList(
      tasks,
      projects,
      {
        due: "all",
        importanceMin: null,
        project: null,
        query: "alpha",
        urgencyMin: null,
      },
      "2026-11-02"
    );

    // Title match (2) + project name "Alpha" match (1); completed (4) excluded
    expect(filtered.map((task) => task.id).sort()).toEqual(["1", "2"]);
  });

  it("sorts by title and by due date with nulls last", () => {
    const open = tasks.filter((task) => !task.isCompleted);
    expect(sortTasksList(open, "title").map((task) => task.id)).toEqual([
      "2",
      "3",
      "1",
    ]);
    expect(sortTasksList(open, "due").map((task) => task.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });
});

describe("mergeTasksBoardPrefs and prefsToSearchParams", () => {
  it("lets URL params override stored prefs and keeps search URL-only", () => {
    const stored = {
      ...DEFAULT_TASKS_BOARD_PREFS,
      due: "today" as const,
      sort: "importance" as const,
    };
    const merged = mergeTasksBoardPrefs(
      { due: "overdue", q: "ship", sort: null },
      stored
    );

    expect(merged.prefs.sort).toBe("importance");
    expect(merged.prefs.due).toBe("overdue");
    expect(merged.query).toBe("ship");
  });

  it("serializes only non-default prefs and the query", () => {
    const params = prefsToSearchParams(
      {
        due: "upcoming",
        importanceMin: 2,
        project: "inbox",
        sort: "due",
        urgencyMin: null,
      },
      " launch "
    );

    expect(params.get("due")).toBe("upcoming");
    expect(params.get("importance")).toBe("2");
    expect(params.get("project")).toBe("inbox");
    expect(params.get("sort")).toBeNull();
    expect(params.get("q")).toBe("launch");
  });

  it("detects active filters", () => {
    expect(hasActiveTasksBoardFilters(DEFAULT_TASKS_BOARD_PREFS, "")).toBe(
      false
    );
    expect(
      hasActiveTasksBoardFilters(
        { ...DEFAULT_TASKS_BOARD_PREFS, project: "inbox" },
        ""
      )
    ).toBe(true);
  });
});
