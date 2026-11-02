import { useCallback, useMemo, useState } from "preact/hooks";
import {
  getDueReminderColor,
  getDueReminderLabel,
  getDueReminderStatus,
} from "../../lib/due-date";
import { orpc } from "../../lib/orpc";
import {
  defaultRatingsForQuadrant,
  formatMinutes,
  getQuadrant,
  QUADRANT_META,
  type QuadrantId,
} from "../../lib/quadrant";
import {
  getLocalDateString,
  type Project,
  type Task,
} from "../../lib/task-helpers";
import { showToast } from "../../lib/toast";

interface Props {
  backlogCount: number;
  budgetMinutes: number;
  plannedMinutes: number;
  projects: Project[];
  tasksByQuadrant: Record<QuadrantId, Task[]>;
  todayCount: number;
}

const ORDER: QuadrantId[] = ["Q1", "Q2", "Q3", "Q4"];

const SHORT_LABEL: Record<QuadrantId, string> = {
  Q1: "Do",
  Q2: "Schedule",
  Q3: "Streamline",
  Q4: "Drop",
};

export default function MobileMatrix({
  tasksByQuadrant: initialByQuadrant,
  projects,
  plannedMinutes,
  budgetMinutes,
  todayCount,
  backlogCount,
}: Props) {
  const [selected, setSelected] = useState<QuadrantId>("Q1");
  const [localTasks, setLocalTasks] = useState(() =>
    ORDER.flatMap((id) => initialByQuadrant[id])
  );
  const [moveTaskId, setMoveTaskId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const tasksByQuadrant = useMemo(() => {
    const buckets: Record<QuadrantId, Task[]> = {
      Q1: [],
      Q2: [],
      Q3: [],
      Q4: [],
    };
    for (const task of localTasks) {
      if (task.isCompleted) {
        continue;
      }
      buckets[getQuadrant(task.isUrgent, task.isImportant)].push(task);
    }
    return buckets;
  }, [localTasks]);

  const tasks = tasksByQuadrant[selected];
  const meta = QUADRANT_META[selected];
  const remaining = Math.max(budgetMinutes - plannedMinutes, 0);
  const percent = Math.round((plannedMinutes / budgetMinutes) * 100);
  const today = getLocalDateString();

  const onTabClick = useCallback((event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const id = button.dataset.quadrant as QuadrantId | undefined;
    if (id) {
      setSelected(id);
    }
  }, []);

  const openMove = useCallback((event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const id = button.dataset.moveTask;
    if (id) {
      setMoveTaskId(id);
    }
  }, []);

  const closeMove = useCallback(() => {
    setMoveTaskId(null);
  }, []);

  const moveToQuadrant = useCallback(
    async (quadrant: QuadrantId) => {
      if (!moveTaskId || isSaving) {
        return;
      }
      const ratings = defaultRatingsForQuadrant(quadrant);
      const previous = localTasks;
      setLocalTasks((current) =>
        current.map((task) =>
          task.id === moveTaskId
            ? {
                ...task,
                isImportant: ratings.isImportant,
                isUrgent: ratings.isUrgent,
              }
            : task
        )
      );
      setMoveTaskId(null);
      setIsSaving(true);
      try {
        await orpc.tasks.update({
          id: moveTaskId,
          isImportant: ratings.isImportant,
          isUrgent: ratings.isUrgent,
        });
        setSelected(quadrant);
      } catch {
        setLocalTasks(previous);
        showToast("Could not move task. Try again.", "error");
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, localTasks, moveTaskId]
  );

  const onMoveTargetClick = useCallback(
    (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const quadrant = button.dataset.quadrant as QuadrantId | undefined;
      if (quadrant) {
        moveToQuadrant(quadrant).catch(() => undefined);
      }
    },
    [moveToQuadrant]
  );

  function projectFor(id: string | null): Project | undefined {
    if (!id) {
      return undefined;
    }
    return projects.find((project) => project.id === id);
  }

  return (
    <div className="space-y-4 lg:hidden">
      <header className="space-y-2">
        <h1 className="font-semibold text-2xl text-text-primary tracking-tight">
          Eisenhower Prioritization
        </h1>
        <p className="tabular-metrics font-mono text-sm text-text-secondary">
          {backlogCount} backlog · {todayCount} on Today · {percent}% capacity
        </p>
        <p className="text-sm text-text-muted">
          Tap cards to calibrate urgency or stage for Today.
        </p>
      </header>

      <div
        aria-label="Matrix quadrants"
        className="flex gap-1 overflow-x-auto rounded-full border border-border-subtle bg-surface-subtle p-1"
        role="tablist"
      >
        {ORDER.map((id) => {
          const count = tasksByQuadrant[id].length;
          const active = id === selected;
          return (
            <button
              aria-selected={active}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 font-medium text-sm ${
                active
                  ? "bg-surface-elevated text-text-primary"
                  : "text-text-secondary"
              }`}
              data-quadrant={id}
              key={id}
              onClick={onTabClick}
              role="tab"
              type="button"
            >
              <span>
                {id} {SHORT_LABEL[id]}
              </span>
              <span className="tabular-metrics font-mono text-xs opacity-70">
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex h-6 items-center rounded-full border px-2 font-medium font-mono text-[10px]"
          style={{
            backgroundColor: `color-mix(in srgb, ${meta.colorVar} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${meta.colorVar} 30%, transparent)`,
            color: meta.colorVar,
          }}
        >
          {meta.intent}
        </span>
        <span className="font-mono text-text-muted text-xs">ETC · Due</span>
      </div>

      <ul className="space-y-3">
        {tasks.length === 0 ? (
          <li className="rounded-sm border border-border-contrast bg-surface px-4 py-10 text-center text-sm text-text-muted">
            No tasks in {selected}. Use Move to quadrant on another card.
          </li>
        ) : (
          tasks.map((task) => {
            const project = projectFor(task.projectId);
            const dueStatus = getDueReminderStatus(task.dueDate, today);
            const dueLabel = getDueReminderLabel(
              dueStatus,
              task.dueDate,
              today
            );
            const dueColor = getDueReminderColor(dueStatus);
            return (
              <li key={task.id}>
                <article
                  className={`rounded-sm border border-border-contrast bg-surface p-3 pl-4 ${meta.accentClass}`}
                >
                  <div className="flex flex-wrap gap-2">
                    {task.isToday ? (
                      <span className="inline-flex h-6 items-center rounded-full border border-primary/30 bg-primary/12 px-2 font-mono text-[10px] text-primary">
                        Today ({formatMinutes(task.estimatedMinutes)})
                      </span>
                    ) : null}
                    {dueLabel ? (
                      <span
                        className="inline-flex h-6 items-center rounded-full border px-2 font-mono text-[10px]"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${dueColor} 12%, transparent)`,
                          borderColor: `color-mix(in srgb, ${dueColor} 30%, transparent)`,
                          color: dueColor,
                        }}
                      >
                        {dueLabel}
                      </span>
                    ) : null}
                    <span className="inline-flex h-6 items-center rounded-full border border-border-contrast bg-surface-subtle px-2 font-mono text-[10px] text-text-secondary">
                      {formatMinutes(task.estimatedMinutes)} ETC
                    </span>
                    {project ? (
                      <span
                        className="inline-flex h-6 items-center rounded-full border px-2 font-mono text-[10px]"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${project.color} 12%, transparent)`,
                          borderColor: `color-mix(in srgb, ${project.color} 30%, transparent)`,
                          color: project.color,
                        }}
                      >
                        #{project.name}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 font-semibold text-base text-text-primary">
                    <button
                      className="task-open text-left"
                      data-task-id={task.id}
                      type="button"
                    >
                      {task.title}
                    </button>
                  </h3>
                  <div className="tabular-metrics mt-2 flex gap-3 font-mono text-text-muted text-xs">
                    <span>Urgency: {task.isUrgent}/3</span>
                    <span>Importance: {task.isImportant}/3</span>
                    {!dueLabel && task.dueDate ? (
                      <span>Due {task.dueDate}</span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="inline-flex min-h-11 items-center rounded-sm border border-border-contrast px-3 font-medium text-sm text-text-primary"
                      data-move-task={task.id}
                      onClick={openMove}
                      type="button"
                    >
                      Move to quadrant
                    </button>
                    {task.isToday ? null : (
                      <button
                        className="inline-flex min-h-11 items-center rounded-sm bg-primary px-3 font-semibold text-on-primary text-sm"
                        data-add-today={task.id}
                        type="button"
                      >
                        + Add to Today ({formatMinutes(task.estimatedMinutes)})
                      </button>
                    )}
                  </div>
                </article>
              </li>
            );
          })
        )}
      </ul>

      {moveTaskId ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center"
          role="dialog"
        >
          <button
            aria-label="Close move sheet"
            className="absolute inset-0"
            onClick={closeMove}
            type="button"
          />
          <div className="relative z-10 w-full max-w-md rounded-t-md border border-border-contrast bg-surface p-4 sm:rounded-md">
            <h3 className="font-semibold text-text-primary">
              Move to quadrant
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Applies default urgency/importance for that quadrant.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {ORDER.map((id) => (
                <button
                  className="flex min-h-11 items-center justify-center rounded-sm border border-border-contrast px-3 text-sm text-text-primary hover:bg-surface-elevated disabled:opacity-60"
                  data-quadrant={id}
                  disabled={isSaving || id === selected}
                  key={id}
                  onClick={onMoveTargetClick}
                  type="button"
                >
                  {id} {SHORT_LABEL[id]}
                </button>
              ))}
            </div>
            <button
              className="mt-3 flex min-h-11 w-full items-center justify-center rounded-sm text-sm text-text-secondary"
              onClick={closeMove}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-sm border border-border-contrast bg-canvas/95 px-3 py-3 backdrop-blur-md">
        <div>
          <p className="font-medium text-sm text-text-primary">
            Today's Capacity Pool
          </p>
          <p className="tabular-metrics font-mono text-text-muted text-xs">
            {remaining} mins unallocated
          </p>
        </div>
        <a
          className="inline-flex min-h-11 items-center rounded-sm border border-border-contrast px-3 font-medium text-sm text-text-primary"
          href="/today"
        >
          Review ({todayCount})
        </a>
      </div>
    </div>
  );
}
