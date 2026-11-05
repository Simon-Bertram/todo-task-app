import { useCallback, useMemo, useState } from "preact/hooks";
import {
  formatMinutes,
  getQuadrant,
  QUADRANT_META,
  type QuadrantId,
} from "../../lib/quadrant";
import {
  getLocalDateString,
  isLongTask,
  type Project,
  type Task,
  type TaskProgressControl,
} from "../../lib/task-helpers";
import {
  useMoveTaskToQuadrant,
  useOptimisticTaskUpdate,
  useTodayFlag,
} from "../../lib/use-task-mutations";
import { useTaskProgressSync } from "../../lib/use-task-progress-sync";
import { TaskMetaChips } from "./task-meta-chips";
import TaskProgress from "./task-progress";

interface Props {
  backlogCount: number;
  budgetMinutes: number;
  plannedMinutes: number;
  projects: Project[];
  taskProgressControl?: TaskProgressControl;
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
  budgetMinutes,
  backlogCount,
  taskProgressControl = "pie",
}: Props) {
  const [selected, setSelected] = useState<QuadrantId>("Q1");
  const [localTasks, setLocalTasks] = useState(() =>
    ORDER.flatMap((id) => initialByQuadrant[id])
  );
  useTaskProgressSync(setLocalTasks);
  const [moveTaskId, setMoveTaskId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isSaving = busyId !== null;

  const updateTask = useOptimisticTaskUpdate(
    localTasks,
    setLocalTasks,
    isSaving,
    setBusyId
  );
  const { addToToday, removeFromToday } = useTodayFlag(updateTask);
  const moveTaskToQuadrant = useMoveTaskToQuadrant(updateTask);

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
  const liveTodayCount = useMemo(
    () => localTasks.filter((task) => task.isToday && !task.isCompleted).length,
    [localTasks]
  );
  const livePlannedMinutes = useMemo(
    () =>
      localTasks
        .filter((task) => task.isToday && !task.isCompleted)
        .reduce((sum, task) => sum + task.estimatedMinutes, 0),
    [localTasks]
  );
  const remaining = Math.max(budgetMinutes - livePlannedMinutes, 0);
  const percent = Math.round((livePlannedMinutes / budgetMinutes) * 100);
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
      if (!moveTaskId) {
        return;
      }
      const id = moveTaskId;
      setMoveTaskId(null);
      const ok = await moveTaskToQuadrant(id, quadrant);
      if (ok) {
        setSelected(quadrant);
      }
    },
    [moveTaskId, moveTaskToQuadrant]
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
          {backlogCount} backlog · {liveTodayCount} on Today · {percent}%
          capacity
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
          tasks.map((task) => (
            <MobileMatrixTaskCard
              accentClass={meta.accentClass}
              busy={isSaving}
              control={taskProgressControl}
              key={task.id}
              onAddToToday={addToToday}
              onMove={openMove}
              onRemoveFromToday={removeFromToday}
              project={projectFor(task.projectId)}
              task={task}
              today={today}
            />
          ))
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
          Review ({liveTodayCount})
        </a>
      </div>
    </div>
  );
}

function MobileMatrixTaskCard({
  task,
  project,
  today,
  accentClass,
  control,
  busy,
  onMove,
  onAddToToday,
  onRemoveFromToday,
}: {
  accentClass: string;
  busy: boolean;
  control: TaskProgressControl;
  onAddToToday: (taskId: string) => void;
  onMove: (event: Event) => void;
  onRemoveFromToday: (taskId: string) => void;
  project: Project | null | undefined;
  task: Task;
  today: string;
}) {
  const showProgress = isLongTask(task.estimatedMinutes);

  const handleAdd = useCallback(() => {
    onAddToToday(task.id);
  }, [onAddToToday, task.id]);

  const handleRemove = useCallback(() => {
    onRemoveFromToday(task.id);
  }, [onRemoveFromToday, task.id]);

  return (
    <li>
      <article
        className={`rounded-sm border border-border-contrast bg-surface p-4 pl-4 ${accentClass}`}
      >
        <div className="flex items-start gap-3">
          <h3 className="min-w-0 flex-1 font-semibold text-base text-text-primary">
            <button
              className="task-open inline-flex min-h-11 w-full items-center text-left"
              data-task-id={task.id}
              type="button"
            >
              {task.title}
            </button>
          </h3>
          {showProgress && control === "pie" ? (
            <div className="shrink-0 pt-1">
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
        <TaskMetaChips project={project} task={task} today={today} />
        {showProgress && control === "slider" ? (
          <div className="mt-2">
            <TaskProgress
              control={control}
              interactive={false}
              progressPercent={task.progressPercent}
              size="compact"
              taskId={task.id}
            />
          </div>
        ) : null}
        <div className="tabular-metrics mt-2 flex flex-wrap gap-3 font-mono text-text-muted text-xs">
          <span>Urgency: {task.isUrgent}/3</span>
          <span>Importance: {task.isImportant}/3</span>
          {task.dueDate ? <span>Due {task.dueDate}</span> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="inline-flex min-h-11 items-center rounded-sm border border-border-contrast px-3 font-medium text-sm text-text-primary disabled:opacity-60"
            data-move-task={task.id}
            disabled={busy}
            onClick={onMove}
            type="button"
          >
            Move to quadrant
          </button>
          {task.isToday ? (
            <button
              className="inline-flex min-h-11 items-center rounded-sm border border-border-contrast px-3 font-medium text-sm text-text-primary disabled:opacity-60"
              data-testid="matrix-remove-today"
              disabled={busy}
              onClick={handleRemove}
              type="button"
            >
              Remove from Today
            </button>
          ) : (
            <button
              className="inline-flex min-h-11 items-center rounded-sm bg-primary px-3 font-semibold text-on-primary text-sm disabled:opacity-60"
              data-testid="matrix-add-today"
              disabled={busy}
              onClick={handleAdd}
              type="button"
            >
              Add to Today ({formatMinutes(task.estimatedMinutes)})
            </button>
          )}
        </div>
      </article>
    </li>
  );
}
