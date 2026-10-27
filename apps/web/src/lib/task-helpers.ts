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
