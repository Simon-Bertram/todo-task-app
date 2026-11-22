import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useId, useState } from "preact/hooks";
import {
  formatDueWithTime,
  getDueReminderColor,
  getDueReminderLabel,
  getDueReminderStatus,
} from "../../lib/due-date";
import { orpc } from "../../lib/orpc";
import { formatMinutes, getQuadrant, QUADRANT_META } from "../../lib/quadrant";
import type {
  Project,
  Subtask,
  Task,
  TaskProgressControl,
} from "../../lib/task-helpers";
import { getLocalDateString, isLongTask } from "../../lib/task-helpers";
import { showToast } from "../../lib/toast";
import TaskProgress from "./task-progress";

interface TaskListRowProps {
  control: TaskProgressControl;
  expanded?: boolean;
  onSubtasksChange?: (taskId: string, subtasks: Subtask[]) => void;
  onToggleExpand?: (taskId: string) => void;
  projects: Project[];
  showDue?: boolean;
  subtasks?: Subtask[];
  task: Task;
}

/** Compact list row shared by Tasks and Projects boards. */
export function TaskListRow({
  task,
  projects,
  control,
  showDue = true,
  expanded = false,
  onToggleExpand,
  subtasks = [],
  onSubtasksChange,
}: TaskListRowProps) {
  const project = projects.find((item) => item.id === task.projectId);
  const quadrant = getQuadrant(task.isUrgent, task.isImportant);
  const meta = QUADRANT_META[quadrant];
  const today = getLocalDateString();
  const dueStatus = getDueReminderStatus(task.dueDate, today);
  const dueLabel = getDueReminderLabel(dueStatus, task.dueDate, today);
  const dueColor = getDueReminderColor(dueStatus);
  const showProgress = isLongTask(task.estimatedMinutes);
  const subtaskCount = task.subtaskCount ?? 0;
  const subtaskCompletedCount = task.subtaskCompletedCount ?? 0;
  const hasSubtasks = subtaskCount > 0;
  const panelId = useId();

  const expandEnabled = typeof onToggleExpand === "function";

  const onExpandClick = useCallback(() => {
    onToggleExpand?.(task.id);
  }, [onToggleExpand, task.id]);

  let expandControl: ComponentChildren = null;
  if (hasSubtasks && expandEnabled) {
    expandControl = (
      <button
        aria-controls={panelId}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-border-contrast bg-surface text-text-secondary hover:bg-surface-elevated"
        onClick={onExpandClick}
        type="button"
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
      </button>
    );
  } else if (expandEnabled) {
    expandControl = <span aria-hidden="true" className="min-w-11 shrink-0" />;
  }

  return (
    <li className="space-y-1">
      <div className="flex items-stretch gap-2">
        {expandControl}

        <button
          className="task-open flex min-h-11 min-w-0 flex-1 flex-col gap-1 rounded-md border border-border-contrast bg-surface px-4 py-3 text-left hover:bg-surface-elevated sm:flex-row sm:items-center sm:gap-3"
          data-task-id={task.id}
          type="button"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-medium text-sm text-text-primary">
              {task.title}
            </span>
            {hasSubtasks ? (
              <span className="tabular-metrics shrink-0 rounded-full border border-border-contrast bg-surface-subtle px-2 py-0.5 font-mono text-text-secondary text-xs">
                {subtaskCompletedCount}/{subtaskCount}
              </span>
            ) : null}
          </span>

          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap sm:justify-end">
            {showDue && dueLabel ? (
              <span
                className="shrink-0 font-mono text-xs"
                style={{ color: dueColor }}
              >
                {formatDueWithTime(dueLabel, task.dueTime)}
              </span>
            ) : null}
            {showDue && !dueLabel && task.dueDate ? (
              <span className="shrink-0 font-mono text-text-muted text-xs">
                {formatDueWithTime(task.dueDate, task.dueTime)}
              </span>
            ) : null}
            {project ? (
              <span
                className="shrink-0 font-mono text-xs"
                style={{ color: project.color }}
              >
                #{project.name}
              </span>
            ) : (
              <span className="shrink-0 font-mono text-text-muted text-xs">
                Inbox
              </span>
            )}
            <span
              className="hidden shrink-0 font-mono text-xs sm:inline"
              style={{ color: meta.colorVar }}
            >
              {quadrant}
            </span>
            <span className="hidden shrink-0 font-mono text-text-muted text-xs sm:inline">
              {formatMinutes(task.estimatedMinutes)}
            </span>
          </span>
        </button>

        {showProgress ? (
          <div className="flex shrink-0 items-center rounded-md border border-border-contrast bg-surface px-2">
            <TaskProgress
              control={control}
              interactive={false}
              progressPercent={task.progressPercent}
              size="compact"
              taskId={task.id}
            />
          </div>
        ) : null}
      </div>

      {hasSubtasks && expanded && onSubtasksChange ? (
        <NestedSubtasks
          onSubtasksChange={onSubtasksChange}
          panelId={panelId}
          subtasks={subtasks}
          taskId={task.id}
        />
      ) : null}
    </li>
  );
}

function NestedSubtasks({
  taskId,
  panelId,
  subtasks,
  onSubtasksChange,
}: {
  onSubtasksChange: (taskId: string, subtasks: Subtask[]) => void;
  panelId: string;
  subtasks: Subtask[];
  taskId: string;
}) {
  const [loading, setLoading] = useState(subtasks.length === 0);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (subtasks.length > 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    orpc.subtasks
      .list({ taskId })
      .then((rows) => {
        if (!cancelled) {
          onSubtasksChange(taskId, rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          showToast("Could not load subtasks.", "error");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onSubtasksChange, subtasks.length, taskId]);

  const onToggle = useCallback(
    async (item: Subtask) => {
      const nextCompleted = !item.isCompleted;
      const previous = subtasks;
      const next = subtasks.map((row) =>
        row.id === item.id ? { ...row, isCompleted: nextCompleted } : row
      );
      onSubtasksChange(taskId, next);
      setBusyId(item.id);
      try {
        await orpc.subtasks.update({
          id: item.id,
          isCompleted: nextCompleted,
        });
      } catch {
        onSubtasksChange(taskId, previous);
        showToast("Could not update subtask. Try again.", "error");
      } finally {
        setBusyId(null);
      }
    },
    [onSubtasksChange, subtasks, taskId]
  );

  return (
    <ul className="space-y-1 pl-4" id={panelId}>
      {loading ? (
        <li className="px-2 py-2 text-sm text-text-muted">Loading…</li>
      ) : (
        subtasks.map((item) => (
          <NestedSubtaskItem
            busy={busyId === item.id}
            item={item}
            key={item.id}
            onToggle={onToggle}
          />
        ))
      )}
    </ul>
  );
}

function NestedSubtaskItem({
  item,
  busy,
  onToggle,
}: {
  busy: boolean;
  item: Subtask;
  onToggle: (item: Subtask) => Promise<void>;
}) {
  const onClick = useCallback(() => {
    onToggle(item).catch(() => undefined);
  }, [item, onToggle]);

  return (
    <li className="flex min-h-11 items-center gap-1 rounded-sm border border-border-contrast bg-surface-subtle">
      <button
        aria-label={
          item.isCompleted ? "Mark subtask incomplete" : "Mark subtask complete"
        }
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-text-secondary disabled:opacity-60"
        disabled={busy}
        onClick={onClick}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`flex size-5 items-center justify-center rounded-sm border ${
            item.isCompleted
              ? "border-capacity-ok bg-capacity-ok text-on-primary"
              : "border-border-contrast"
          }`}
        >
          {item.isCompleted ? "✓" : ""}
        </span>
      </button>
      <span
        className={`min-w-0 flex-1 truncate pr-3 text-sm ${
          item.isCompleted
            ? "text-text-muted line-through"
            : "text-text-primary"
        }`}
        title={item.title}
      >
        {item.title}
      </span>
    </li>
  );
}
