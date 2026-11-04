import { orpc } from "./orpc";
import { showToast } from "./toast";

export type ProgressFillToken = "empty" | "low" | "mid" | "high" | "done";

export const TASK_PROGRESS_UPDATED_EVENT = "plansage:task-progress-updated";

export interface TaskProgressUpdatedDetail {
  progressPercent: number;
  taskId: string;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function clampProgressPercent(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Advance pie one quarter: 0 → 25 → 50 → 75 → 100 → 0. */
export function nextPieQuarter(percent: number): number {
  const clamped = clampProgressPercent(percent);
  if (clamped >= 100) {
    return 0;
  }
  const next = Math.ceil((clamped + 1) / 25) * 25;
  return Math.min(100, next);
}

/** How many full quarters are filled (0–4) for display. */
export function filledQuarterCount(percent: number): number {
  return Math.min(4, Math.floor(clampProgressPercent(percent) / 25));
}

export function progressFillToken(percent: number): ProgressFillToken {
  const value = clampProgressPercent(percent);
  if (value <= 0) {
    return "empty";
  }
  if (value >= 100) {
    return "done";
  }
  if (value >= 75) {
    return "high";
  }
  if (value >= 50) {
    return "mid";
  }
  return "low";
}

export function progressFillCssVar(percent: number): string {
  const token = progressFillToken(percent);
  if (token === "empty") {
    return "var(--color-progress-empty)";
  }
  return `var(--color-progress-${token})`;
}

export function progressAriaLabel(percent: number): string {
  return `Task progress, ${clampProgressPercent(percent)} percent`;
}

export function dispatchTaskProgressUpdated(
  taskId: string,
  progressPercent: number
): void {
  document.dispatchEvent(
    new CustomEvent<TaskProgressUpdatedDetail>(TASK_PROGRESS_UPDATED_EVENT, {
      detail: { progressPercent, taskId },
    })
  );
}

export async function persistTaskProgress(
  taskId: string,
  progressPercent: number
): Promise<boolean> {
  const next = clampProgressPercent(progressPercent);
  try {
    await orpc.tasks.update({ id: taskId, progressPercent: next });
    dispatchTaskProgressUpdated(taskId, next);
    return true;
  } catch {
    showToast("Could not save progress. Try again.", "error");
    return false;
  }
}

export function openTaskSheet(
  taskId: string,
  focus: "progress" | null = null
): void {
  const detail: { taskId: string; focus?: string } = { taskId };
  if (focus) {
    detail.focus = focus;
  }
  document.dispatchEvent(new CustomEvent("plansage:open-task", { detail }));
}
