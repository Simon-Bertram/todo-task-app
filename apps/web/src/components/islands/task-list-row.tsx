import {
  getDueReminderColor,
  getDueReminderLabel,
  getDueReminderStatus,
} from "../../lib/due-date";
import { formatMinutes, getQuadrant, QUADRANT_META } from "../../lib/quadrant";
import {
  getLocalDateString,
  isLongTask,
  type Project,
  type Task,
  type TaskProgressControl,
} from "../../lib/task-helpers";
import TaskProgress from "./task-progress";

interface TaskListRowProps {
  control: TaskProgressControl;
  projects: Project[];
  showDue?: boolean;
  task: Task;
}

/** Compact list row shared by Tasks and Projects boards. */
export function TaskListRow({
  task,
  projects,
  control,
  showDue = true,
}: TaskListRowProps) {
  const project = projects.find((item) => item.id === task.projectId);
  const quadrant = getQuadrant(task.isUrgent, task.isImportant);
  const meta = QUADRANT_META[quadrant];
  const today = getLocalDateString();
  const dueStatus = getDueReminderStatus(task.dueDate, today);
  const dueLabel = getDueReminderLabel(dueStatus, task.dueDate, today);
  const dueColor = getDueReminderColor(dueStatus);
  const showProgress = isLongTask(task.estimatedMinutes);

  return (
    <li className="flex items-stretch gap-2">
      <button
        className="task-open flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md border border-border-contrast bg-surface px-4 py-3 text-left hover:bg-surface-elevated"
        data-task-id={task.id}
        type="button"
      >
        <span className="min-w-0 flex-1 truncate font-medium text-sm text-text-primary">
          {task.title}
        </span>
        {showDue && dueLabel ? (
          <span
            className="shrink-0 font-mono text-xs"
            style={{ color: dueColor }}
          >
            {dueLabel}
          </span>
        ) : null}
        {showDue && !dueLabel && task.dueDate ? (
          <span className="shrink-0 font-mono text-text-muted text-xs">
            {task.dueDate}
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
          className="shrink-0 font-mono text-xs"
          style={{ color: meta.colorVar }}
        >
          {quadrant}
        </span>
        <span className="shrink-0 font-mono text-text-muted text-xs">
          {formatMinutes(task.estimatedMinutes)}
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
    </li>
  );
}
