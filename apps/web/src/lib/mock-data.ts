import {
  type CapacityBucket,
  getCapacityBucket,
  getQuadrant,
  type QuadrantId,
} from "./quadrant";

export interface MockProject {
  color: string;
  id: string;
  name: string;
}

export interface MockTask {
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

export const dailyCapacityMinutes = 300;

export const mockProjects: MockProject[] = [
  { color: "#38BDF8", id: "proj-backend", name: "backend" },
  { color: "#F59E0B", id: "proj-ops", name: "ops" },
  { color: "#F43F5E", id: "proj-security", name: "security" },
  { color: "#94A3B8", id: "proj-infra", name: "infrastructure" },
];

export const mockTasks: MockTask[] = [
  {
    dueDate: "2026-10-27",
    estimatedMinutes: 90,
    id: "task-1",
    isCompleted: false,
    isImportant: 3,
    isToday: true,
    isUrgent: 3,
    notes: "Align Better Auth user prefs with daily capacity column.",
    projectId: "proj-backend",
    recurrenceRule: null,
    sortOrder: 0,
    title: "Refactor Cloudflare D1 Auth Schema & Migrations",
  },
  {
    dueDate: "2026-10-28",
    estimatedMinutes: 45,
    id: "task-2",
    isCompleted: false,
    isImportant: 3,
    isToday: true,
    isUrgent: 1,
    notes: "Capture strategic wins before sprint close.",
    projectId: "proj-ops",
    recurrenceRule: null,
    sortOrder: 1,
    title: "Write Q3 Retrospective & OKR Roadmap",
  },
  {
    dueDate: "2026-10-27",
    estimatedMinutes: 30,
    id: "task-3",
    isCompleted: false,
    isImportant: 1,
    isToday: true,
    isUrgent: 2,
    notes: null,
    projectId: "proj-backend",
    recurrenceRule: null,
    sortOrder: 2,
    title: "Review PR #142 for optimistic Preact island updates",
  },
  {
    dueDate: "2026-10-27",
    estimatedMinutes: 15,
    id: "task-4",
    isCompleted: false,
    isImportant: 2,
    isToday: true,
    isUrgent: 2,
    notes: null,
    projectId: "proj-ops",
    recurrenceRule: null,
    sortOrder: 3,
    title: "Send invoice to ACME Labs",
  },
  {
    dueDate: null,
    estimatedMinutes: 10,
    id: "task-5",
    isCompleted: false,
    isImportant: 1,
    isToday: true,
    isUrgent: 1,
    notes: null,
    projectId: "proj-ops",
    recurrenceRule: null,
    sortOrder: 4,
    title: "Clear inbox zero for support aliases",
  },
  {
    dueDate: "2026-10-29",
    estimatedMinutes: 10,
    id: "task-6",
    isCompleted: false,
    isImportant: 2,
    isToday: true,
    isUrgent: 1,
    notes: null,
    projectId: "proj-ops",
    recurrenceRule: null,
    sortOrder: 5,
    title: "Schedule 1:1 sync with design partner",
  },
  {
    dueDate: "2026-10-27",
    estimatedMinutes: 60,
    id: "task-7",
    isCompleted: false,
    isImportant: 2,
    isToday: false,
    isUrgent: 3,
    notes: "Verify Better Auth trustedOrigins in staging.",
    projectId: "proj-security",
    recurrenceRule: null,
    sortOrder: 0,
    title: "Patch Workers CORS for cross-origin cookies",
  },
  {
    dueDate: "2026-11-02",
    estimatedMinutes: 75,
    id: "task-8",
    isCompleted: false,
    isImportant: 3,
    isToday: false,
    isUrgent: 0,
    notes: "Pragmatic DnD vs native HTML5.",
    projectId: "proj-backend",
    recurrenceRule: null,
    sortOrder: 1,
    title: "Draft architecture ADR for Matrix DnD island",
  },
  {
    dueDate: "2026-10-27",
    estimatedMinutes: 20,
    id: "task-9",
    isCompleted: false,
    isImportant: 0,
    isToday: false,
    isUrgent: 3,
    notes: null,
    projectId: "proj-ops",
    recurrenceRule: null,
    sortOrder: 2,
    title: "Approve vendor access request #884",
  },
  {
    dueDate: null,
    estimatedMinutes: 25,
    id: "task-10",
    isCompleted: false,
    isImportant: 0,
    isToday: false,
    isUrgent: 0,
    notes: null,
    projectId: "proj-ops",
    recurrenceRule: null,
    sortOrder: 3,
    title: "Archive stale Notion backlog dump",
  },
  {
    dueDate: "2026-10-28",
    estimatedMinutes: 40,
    id: "task-11",
    isCompleted: false,
    isImportant: 3,
    isToday: false,
    isUrgent: 2,
    notes: null,
    projectId: "proj-security",
    recurrenceRule: null,
    sortOrder: 4,
    title: "Rotate staging D1 backup credentials",
  },
  {
    dueDate: null,
    estimatedMinutes: 35,
    id: "task-12",
    isCompleted: false,
    isImportant: 2,
    isToday: false,
    isUrgent: 1,
    notes: null,
    projectId: "proj-infra",
    recurrenceRule: "WEEKDAYS",
    sortOrder: 5,
    title: "Sketch capacity warning microcopy",
  },
  {
    dueDate: "2026-10-27",
    estimatedMinutes: 45,
    id: "task-13",
    isCompleted: false,
    isImportant: 1,
    isToday: false,
    isUrgent: 3,
    notes: null,
    projectId: "proj-security",
    recurrenceRule: null,
    sortOrder: 6,
    title: "Triage Sentry noise from auth edge",
  },
  {
    dueDate: null,
    estimatedMinutes: 15,
    id: "task-14",
    isCompleted: false,
    isImportant: 1,
    isToday: false,
    isUrgent: 0,
    notes: null,
    projectId: "proj-infra",
    recurrenceRule: null,
    sortOrder: 7,
    title: "Browse font pairing for APEX wordmark",
  },
  {
    dueDate: "2026-10-30",
    estimatedMinutes: 50,
    id: "task-15",
    isCompleted: false,
    isImportant: 2,
    isToday: false,
    isUrgent: 1,
    notes: null,
    projectId: "proj-infra",
    recurrenceRule: null,
    sortOrder: 8,
    title: "Document Alchemy local auth pairing steps",
  },
  {
    dueDate: "2026-10-27",
    estimatedMinutes: 25,
    id: "task-16",
    isCompleted: false,
    isImportant: 2,
    isToday: false,
    isUrgent: 3,
    notes: null,
    projectId: "proj-ops",
    recurrenceRule: null,
    sortOrder: 9,
    title: "Reply to customer escalation thread",
  },
];

export function getProject(projectId: string | null): MockProject | null {
  if (!projectId) {
    return null;
  }
  return mockProjects.find((project) => project.id === projectId) ?? null;
}

export function getTaskQuadrant(task: MockTask): QuadrantId {
  return getQuadrant(task.isUrgent, task.isImportant);
}

export function getTodayTasks(): MockTask[] {
  return mockTasks
    .filter((task) => task.isToday && !task.isCompleted)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getTodayPlannedMinutes(): number {
  return getTodayTasks().reduce((sum, task) => sum + task.estimatedMinutes, 0);
}

export function getTasksByQuadrant(): Record<QuadrantId, MockTask[]> {
  const buckets: Record<QuadrantId, MockTask[]> = {
    Q1: [],
    Q2: [],
    Q3: [],
    Q4: [],
  };
  for (const task of mockTasks) {
    if (task.isCompleted) {
      continue;
    }
    buckets[getTaskQuadrant(task)].push(task);
  }
  return buckets;
}

export function getTodayByBucket(): Record<CapacityBucket, MockTask[]> {
  const groups: Record<CapacityBucket, MockTask[]> = {
    major: [],
    medium: [],
    other: [],
    quick: [],
  };
  for (const task of getTodayTasks()) {
    groups[getCapacityBucket(task.estimatedMinutes)].push(task);
  }
  return groups;
}

export function getTaskById(id: string): MockTask | undefined {
  return mockTasks.find((task) => task.id === id);
}
