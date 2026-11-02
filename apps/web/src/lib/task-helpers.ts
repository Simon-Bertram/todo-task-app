import type { TasksBoardPrefs } from "@todo-task-app/api/schemas/tasks-board-prefs";
import {
  DEFAULT_TASKS_BOARD_PREFS,
  tasksBoardDueSchema,
  tasksBoardPriorityMinSchema,
  tasksBoardSortSchema,
} from "@todo-task-app/api/schemas/tasks-board-prefs";

import {
  type CapacityBucket,
  getCapacityBucket,
  getQuadrant,
  type QuadrantId,
} from "./quadrant";

export interface Project {
  color: string;
  id: string;
  name: string;
}

export interface Task {
  completedAt?: Date | string | null;
  dueDate: string | null;
  estimatedMinutes: number;
  id: string;
  isCompleted: boolean;
  isImportant: number;
  isToday: boolean;
  isUrgent: number;
  notes: string | null;
  projectId: string | null;
  recurrenceRule: string | null;
  sortOrder: number;
  title: string;
}

export interface TasksBoardUrlParams {
  due?: string | null;
  importance?: string | null;
  project?: string | null;
  q?: string | null;
  sort?: string | null;
  urgency?: string | null;
}

export interface TasksBoardFilterCriteria {
  due: TasksBoardPrefs["due"];
  importanceMin: TasksBoardPrefs["importanceMin"];
  project: TasksBoardPrefs["project"];
  query: string;
  urgencyMin: TasksBoardPrefs["urgencyMin"];
}

export const DEFAULT_DAILY_CAPACITY_MINUTES = 300;

export function getProject(
  projects: Project[],
  projectId: string | null
): Project | null {
  if (!projectId) {
    return null;
  }
  return projects.find((project) => project.id === projectId) ?? null;
}

export function getTaskQuadrant(task: Task): QuadrantId {
  return getQuadrant(task.isUrgent, task.isImportant);
}

export function getTodayTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((task) => task.isToday && !task.isCompleted)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getStagedTodayTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((task) => task.isToday)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getTodayExecutionProgress(tasks: Task[]): {
  completedCount: number;
  completedMinutes: number;
  dayProtected: boolean;
  percent: number;
  stagedCount: number;
  stagedMinutes: number;
} {
  const staged = getStagedTodayTasks(tasks);
  const stagedMinutes = staged.reduce(
    (sum, task) => sum + task.estimatedMinutes,
    0
  );
  const completed = staged.filter((task) => task.isCompleted);
  const completedMinutes = completed.reduce(
    (sum, task) => sum + task.estimatedMinutes,
    0
  );
  const percent =
    stagedMinutes === 0
      ? 0
      : Math.round((completedMinutes / stagedMinutes) * 100);
  return {
    completedCount: completed.length,
    completedMinutes,
    dayProtected: staged.length > 0 && completed.length === staged.length,
    percent,
    stagedCount: staged.length,
    stagedMinutes,
  };
}

export function getTodayPlannedMinutes(tasks: Task[]): number {
  return getTodayTasks(tasks).reduce(
    (sum, task) => sum + task.estimatedMinutes,
    0
  );
}

export function getTasksByQuadrant(tasks: Task[]): Record<QuadrantId, Task[]> {
  const buckets: Record<QuadrantId, Task[]> = {
    Q1: [],
    Q2: [],
    Q3: [],
    Q4: [],
  };
  for (const task of tasks) {
    if (task.isCompleted) {
      continue;
    }
    buckets[getTaskQuadrant(task)].push(task);
  }
  return buckets;
}

export function getTodayByBucket(
  tasks: Task[]
): Record<CapacityBucket, Task[]> {
  const groups: Record<CapacityBucket, Task[]> = {
    major: [],
    medium: [],
    other: [],
    quick: [],
  };
  for (const task of getTodayTasks(tasks)) {
    groups[getCapacityBucket(task.estimatedMinutes)].push(task);
  }
  return groups;
}

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function matchesDueDateFilter(
  task: Task,
  filter: TasksBoardPrefs["due"],
  today: string
): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "none") {
    return task.dueDate === null;
  }
  if (task.dueDate === null) {
    return false;
  }
  if (filter === "overdue") {
    return task.dueDate < today;
  }
  if (filter === "today") {
    return task.dueDate === today;
  }
  return task.dueDate > today;
}

export function matchesPriorityMin(
  value: number,
  min: TasksBoardPrefs["importanceMin"]
): boolean {
  if (min === null) {
    return true;
  }
  return value >= min;
}

function matchesProjectFilter(
  task: Task,
  project: TasksBoardPrefs["project"]
): boolean {
  if (project === null) {
    return true;
  }
  if (project === "inbox") {
    return task.projectId === null;
  }
  return task.projectId === project;
}

function matchesSearch(
  task: Task,
  projects: Project[],
  query: string
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }
  if (task.title.toLowerCase().includes(trimmed)) {
    return true;
  }
  const project = getProject(projects, task.projectId);
  return project?.name.toLowerCase().includes(trimmed) ?? false;
}

export function filterTasksList(
  tasks: Task[],
  projects: Project[],
  criteria: TasksBoardFilterCriteria,
  today: string = getLocalDateString()
): Task[] {
  return tasks.filter((task) => {
    if (task.isCompleted) {
      return false;
    }
    return (
      matchesProjectFilter(task, criteria.project) &&
      matchesDueDateFilter(task, criteria.due, today) &&
      matchesPriorityMin(task.isImportant, criteria.importanceMin) &&
      matchesPriorityMin(task.isUrgent, criteria.urgencyMin) &&
      matchesSearch(task, projects, criteria.query)
    );
  });
}

export function sortTasksList(
  tasks: Task[],
  sort: TasksBoardPrefs["sort"]
): Task[] {
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }
    if (sort === "importance") {
      return b.isImportant - a.isImportant || a.sortOrder - b.sortOrder;
    }
    if (sort === "urgency") {
      return b.isUrgent - a.isUrgent || a.sortOrder - b.sortOrder;
    }
    // due: nulls last, then ascending date, then sortOrder
    if (a.dueDate === null && b.dueDate === null) {
      return a.sortOrder - b.sortOrder;
    }
    if (a.dueDate === null) {
      return 1;
    }
    if (b.dueDate === null) {
      return -1;
    }
    return a.dueDate.localeCompare(b.dueDate) || a.sortOrder - b.sortOrder;
  });
  return sorted;
}

function parsePriorityMinParam(
  raw: string | null | undefined
): TasksBoardPrefs["importanceMin"] | undefined {
  if (raw === null || raw === undefined || raw === "" || raw === "any") {
    return undefined;
  }
  const asNumber = Number(raw);
  const parsed = tasksBoardPriorityMinSchema.safeParse(asNumber);
  return parsed.success ? parsed.data : undefined;
}

export function parseTasksBoardUrlParams(
  params: TasksBoardUrlParams
): Partial<TasksBoardPrefs> & { query?: string } {
  const result: Partial<TasksBoardPrefs> & { query?: string } = {};

  if (params.sort) {
    const sort = tasksBoardSortSchema.safeParse(params.sort);
    if (sort.success) {
      result.sort = sort.data;
    }
  }

  if (params.due) {
    const due = tasksBoardDueSchema.safeParse(params.due);
    if (due.success) {
      result.due = due.data;
    }
  }

  if (params.project !== null && params.project !== undefined) {
    if (params.project === "all" || params.project === "") {
      result.project = null;
    } else {
      result.project = params.project;
    }
  }

  const importanceMin = parsePriorityMinParam(params.importance);
  if (importanceMin !== undefined) {
    result.importanceMin = importanceMin;
  } else if (params.importance === "any") {
    result.importanceMin = null;
  }

  const urgencyMin = parsePriorityMinParam(params.urgency);
  if (urgencyMin !== undefined) {
    result.urgencyMin = urgencyMin;
  } else if (params.urgency === "any") {
    result.urgencyMin = null;
  }

  if (params.q !== null && params.q !== undefined) {
    result.query = params.q;
  }

  return result;
}

export function mergeTasksBoardPrefs(
  url: TasksBoardUrlParams,
  stored: TasksBoardPrefs
): { prefs: TasksBoardPrefs; query: string } {
  const fromUrl = parseTasksBoardUrlParams(url);
  return {
    prefs: {
      due: fromUrl.due ?? stored.due,
      importanceMin:
        fromUrl.importanceMin === undefined
          ? stored.importanceMin
          : fromUrl.importanceMin,
      project: fromUrl.project === undefined ? stored.project : fromUrl.project,
      sort: fromUrl.sort ?? stored.sort,
      urgencyMin:
        fromUrl.urgencyMin === undefined
          ? stored.urgencyMin
          : fromUrl.urgencyMin,
    },
    query: fromUrl.query ?? "",
  };
}

export function prefsToSearchParams(
  prefs: TasksBoardPrefs,
  query: string
): URLSearchParams {
  const params = new URLSearchParams();

  if (prefs.sort !== DEFAULT_TASKS_BOARD_PREFS.sort) {
    params.set("sort", prefs.sort);
  }
  if (prefs.due !== DEFAULT_TASKS_BOARD_PREFS.due) {
    params.set("due", prefs.due);
  }
  if (prefs.project !== null) {
    params.set("project", prefs.project);
  }
  if (prefs.importanceMin !== null) {
    params.set("importance", String(prefs.importanceMin));
  }
  if (prefs.urgencyMin !== null) {
    params.set("urgency", String(prefs.urgencyMin));
  }
  const trimmed = query.trim();
  if (trimmed) {
    params.set("q", trimmed);
  }

  return params;
}

export function hasActiveTasksBoardFilters(
  prefs: TasksBoardPrefs,
  query: string
): boolean {
  return (
    prefs.project !== null ||
    prefs.due !== "all" ||
    prefs.importanceMin !== null ||
    prefs.urgencyMin !== null ||
    query.trim().length > 0
  );
}
