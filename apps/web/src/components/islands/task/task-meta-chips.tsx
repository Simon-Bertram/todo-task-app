import {
  formatDueWithTime,
  getDueReminderColor,
  getDueReminderLabel,
  getDueReminderStatus,
} from "@/lib/tasks/due-date";
import {
  formatMinutes,
  getQuadrant,
  QUADRANT_META,
} from "@/lib/tasks/quadrant";
import type { Project, Task } from "@/lib/tasks/task-helpers";

function tintStyle(color: string): {
  backgroundColor: string;
  borderColor: string;
  color: string;
} {
  return {
    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
    color,
  };
}

function formatDueChipLabel(
  dueLabel: string | null,
  dueDate: string | null,
  dueTime: string | null
): string | null {
  if (dueLabel) {
    return formatDueWithTime(dueLabel, dueTime);
  }
  if (dueDate) {
    return formatDueWithTime(dueDate, dueTime);
  }
  return dueTime;
}

interface TaskMetaChipsProps {
  project?: Project | null;
  showQuadrant?: boolean;
  showTodayChip?: boolean;
  task: Task;
  today: string;
}

/** Pill chips for due / ETC / project / quadrant / Today on board cards. */
export function TaskMetaChips({
  task,
  project,
  today,
  showTodayChip = true,
  showQuadrant = false,
}: TaskMetaChipsProps) {
  const dueStatus = getDueReminderStatus(task.dueDate, today);
  const dueLabel = getDueReminderLabel(dueStatus, task.dueDate, today);
  const dueColor = getDueReminderColor(dueStatus);
  const dueChipLabel = formatDueChipLabel(dueLabel, task.dueDate, task.dueTime);
  const quadrant = getQuadrant(task.isUrgent, task.isImportant);
  const meta = QUADRANT_META[quadrant];

  return (
    <div className="mt-2 flex flex-wrap items-start gap-2">
      {showTodayChip && task.isToday ? (
        <span className="inline-flex min-h-6 items-center rounded-full border border-primary/30 bg-primary/12 px-2 font-mono text-primary text-xs">
          Today
        </span>
      ) : null}
      {showQuadrant ? (
        <a
          className="inline-flex min-h-11 items-center rounded-full border px-2 font-mono text-xs hover:opacity-90"
          href={`/matrix?quadrant=${quadrant}`}
          style={tintStyle(meta.colorVar)}
        >
          {quadrant} {meta.label}
        </a>
      ) : null}
      {dueChipLabel ? (
        <span
          className="inline-flex min-h-6 items-center rounded-full border px-2 font-mono text-xs"
          style={tintStyle(dueColor)}
        >
          {dueChipLabel}
        </span>
      ) : null}
      <span className="inline-flex min-h-6 items-center rounded-full border border-border-contrast bg-surface-subtle px-2 font-mono text-text-secondary text-xs">
        {formatMinutes(task.estimatedMinutes)} ETC
      </span>
      {project ? (
        <span
          className="inline-flex min-h-6 items-center rounded-full border px-2 font-mono text-xs"
          style={tintStyle(project.color)}
        >
          #{project.name}
        </span>
      ) : null}
      {(task.subtaskCount ?? 0) > 0 ? (
        <span className="tabular-metrics inline-flex min-h-6 items-center rounded-full border border-border-contrast bg-surface-subtle px-2 font-mono text-text-secondary text-xs">
          {task.subtaskCompletedCount ?? 0}/{task.subtaskCount}
        </span>
      ) : null}
    </div>
  );
}
