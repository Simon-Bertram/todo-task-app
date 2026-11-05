import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import {
  capacityTone,
  capacityToneBarClass,
  capacityToneTextClass,
  formatMinutes,
  QUADRANT_META,
  type QuadrantId,
} from "../../lib/quadrant";
import { stopPointerPropagation } from "../../lib/stop-pointer";
import {
  getLocalDateString,
  getProject,
  getTaskQuadrant,
  getTodayPlannedMinutes,
  getTodayTasks,
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
  budgetMinutes: number;
  initialFilter?: string;
  projects: Project[];
  taskProgressControl?: TaskProgressControl;
  tasks: Task[];
}

const ORDER: QuadrantId[] = ["Q1", "Q2", "Q3", "Q4"];

function isTaskDrag(data: Record<string | symbol, unknown>): boolean {
  return data.type === "task" && typeof data.taskId === "string";
}

function taskIdFromData(data: Record<string | symbol, unknown>): string | null {
  return typeof data.taskId === "string" ? data.taskId : null;
}

export default function DesktopMatrixBoard({
  tasks: initialTasks,
  projects,
  budgetMinutes,
  initialFilter = "all",
  taskProgressControl = "pie",
}: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  useTaskProgressSync(setTasks);
  const [filter, setFilter] = useState(initialFilter);
  const [dockHoverMinutes, setDockHoverMinutes] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isSaving = busyId !== null;

  const updateTask = useOptimisticTaskUpdate(
    tasks,
    setTasks,
    isSaving,
    setBusyId
  );
  const { addToToday, removeFromToday } = useTodayFlag(updateTask);
  const moveToQuadrant = useMoveTaskToQuadrant(updateTask);

  const plannedMinutes = getTodayPlannedMinutes(tasks);
  const previewPlanned =
    dockHoverMinutes === null
      ? plannedMinutes
      : plannedMinutes + dockHoverMinutes;
  const todayCount = getTodayTasks(tasks).length;
  const backlogCount = tasks.filter((task) => !task.isCompleted).length;
  const percent = Math.round((plannedMinutes / budgetMinutes) * 100);

  const byQuadrant = useMemo(() => {
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
      if (filter === "today" && !task.isToday) {
        continue;
      }
      if (filter === "not-today" && task.isToday) {
        continue;
      }
      buckets[getTaskQuadrant(task)].push(task);
    }
    return buckets;
  }, [filter, tasks]);

  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => isTaskDrag(source.data),
        onDrop: ({ source, location }) => {
          const [target] = location.current.dropTargets;
          const taskId = taskIdFromData(source.data);
          if (!(target && isTaskDrag(source.data) && taskId)) {
            return;
          }
          const { dropType, quadrant } = target.data;
          if (dropType === "quadrant" && typeof quadrant === "string") {
            moveToQuadrant(taskId, quadrant as QuadrantId).catch(
              () => undefined
            );
            return;
          }
          if (dropType === "today") {
            addToToday(taskId).catch(() => undefined);
          }
        },
      }),
    [addToToday, moveToQuadrant]
  );

  const onFilterClick = useCallback((event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const next = button.dataset.filter;
    if (next) {
      setFilter(next);
      const url = new URL(window.location.href);
      url.searchParams.set("filter", next);
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  return (
    <div className="hidden min-h-[calc(100svh-0px)] lg:flex">
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-semibold text-2xl text-text-primary tracking-tight">
                Eisenhower Prioritization Matrix
              </h1>
              <p className="tabular-metrics mt-1 font-mono text-sm text-text-secondary">
                {backlogCount} backlog · {todayCount} on Today · {percent}% load
                {isSaving ? " · Saving…" : ""}
              </p>
            </div>
          </div>
          <div
            aria-label="Today filter"
            className="flex gap-1 overflow-x-auto rounded-full border border-border-subtle bg-surface-subtle p-1"
            role="tablist"
          >
            {[
              { id: "all", label: "All" },
              { id: "not-today", label: "Not on Today" },
              { id: "today", label: "On Today" },
            ].map((option) => {
              const selected = filter === option.id;
              return (
                <button
                  aria-selected={selected}
                  className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-3 font-medium text-sm ${
                    selected
                      ? "bg-surface-elevated text-text-primary"
                      : "text-text-secondary"
                  }`}
                  data-filter={option.id}
                  key={option.id}
                  onClick={onFilterClick}
                  role="tab"
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-6 font-mono text-text-muted text-xs">
            <span>Importance ↑</span>
            <span>Urgency →</span>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3">
          {ORDER.map((quadrant) => (
            <QuadrantDrop
              control={taskProgressControl}
              key={quadrant}
              onAddToToday={addToToday}
              onRemoveFromToday={removeFromToday}
              projects={projects}
              quadrant={quadrant}
              tasks={byQuadrant[quadrant]}
            />
          ))}
        </div>
      </div>

      <TodayDockDrop
        budgetMinutes={budgetMinutes}
        dockHoverMinutes={dockHoverMinutes}
        onHoverMinutes={setDockHoverMinutes}
        previewPlanned={previewPlanned}
        tasks={tasks}
      />
    </div>
  );
}

function QuadrantDrop({
  quadrant,
  tasks,
  projects,
  control,
  onAddToToday,
  onRemoveFromToday,
}: {
  control: TaskProgressControl;
  onAddToToday: (taskId: string) => void;
  onRemoveFromToday: (taskId: string) => void;
  projects: Project[];
  quadrant: QuadrantId;
  tasks: Task[];
}) {
  const ref = useRef<HTMLElement>(null);
  const [isOver, setIsOver] = useState(false);
  const meta = QUADRANT_META[quadrant];

  useEffect(() => {
    const element = ref.current as HTMLElement | null;
    if (!element) {
      return;
    }
    return dropTargetForElements({
      canDrop: ({ source }) => isTaskDrag(source.data),
      element,
      getData: () => ({ dropType: "quadrant", quadrant }),
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: () => setIsOver(false),
    });
  }, [quadrant]);

  return (
    <section
      aria-labelledby={`quad-${quadrant}`}
      className={`flex min-h-64 flex-col rounded-md border p-3 ${meta.tintClass} ${
        isOver
          ? "border-primary ring-2 ring-primary/40"
          : "border-border-contrast"
      }`}
      ref={ref}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2
            className="font-semibold text-sm tracking-wide"
            id={`quad-${quadrant}`}
            style={{ color: meta.colorVar }}
          >
            {quadrant} {meta.label.toUpperCase()}
          </h2>
          <p className="mt-0.5 text-text-muted text-xs">{meta.intent}</p>
        </div>
        <span
          className="tabular-metrics font-mono text-xs"
          style={{ color: meta.colorVar }}
        >
          {tasks.length}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="m-auto px-2 py-8 text-center text-sm text-text-muted">
            Empty — drop tasks here to set {quadrant} defaults.
          </p>
        ) : (
          tasks.map((task) => (
            <DraggableTaskCard
              control={control}
              key={task.id}
              onAddToToday={onAddToToday}
              onRemoveFromToday={onRemoveFromToday}
              projects={projects}
              task={task}
            />
          ))
        )}
      </div>
    </section>
  );
}

function DraggableTaskCard({
  task,
  projects,
  control,
  onAddToToday,
  onRemoveFromToday,
}: {
  control: TaskProgressControl;
  onAddToToday: (taskId: string) => void;
  onRemoveFromToday: (taskId: string) => void;
  projects: Project[];
  task: Task;
}) {
  const ref = useRef<HTMLElement>(null);
  const [dragging, setDragging] = useState(false);
  const quadrant = getTaskQuadrant(task);
  const meta = QUADRANT_META[quadrant];
  const project = getProject(projects, task.projectId);
  const today = getLocalDateString();
  const showProgress = isLongTask(task.estimatedMinutes);

  useEffect(() => {
    const element = ref.current as HTMLElement | null;
    if (!element) {
      return;
    }
    return draggable({
      element,
      getInitialData: () => ({
        estimatedMinutes: task.estimatedMinutes,
        taskId: task.id,
        type: "task",
      }),
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [task.estimatedMinutes, task.id]);

  const handleAdd = useCallback(() => {
    onAddToToday(task.id);
  }, [onAddToToday, task.id]);

  const handleRemove = useCallback(() => {
    onRemoveFromToday(task.id);
  }, [onRemoveFromToday, task.id]);

  return (
    <article
      className={`rounded-sm border border-border-contrast bg-surface p-4 pl-4 ${meta.accentClass} ${
        dragging ? "opacity-60" : ""
      }`}
      data-task-id={task.id}
      ref={ref}
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 font-semibold text-base text-text-primary leading-snug">
          <button
            className="task-open inline-flex min-h-11 w-full items-center text-left hover:text-primary"
            data-task-id={task.id}
            type="button"
          >
            {task.title}
          </button>
        </h3>
        {showProgress && control === "pie" ? (
          <div className="shrink-0 pt-1" onPointerDown={stopPointerPropagation}>
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
        <div className="mt-2" onPointerDown={stopPointerPropagation}>
          <TaskProgress
            control={control}
            interactive={false}
            progressPercent={task.progressPercent}
            size="compact"
            taskId={task.id}
          />
        </div>
      ) : null}
      <div className="tabular-metrics mt-3 flex flex-wrap items-center gap-3 font-mono text-text-muted text-xs">
        <span>Urgency: {task.isUrgent}/3</span>
        <span>Importance: {task.isImportant}/3</span>
      </div>
      <div className="mt-3" onPointerDown={stopPointerPropagation}>
        {task.isToday ? (
          <button
            className="inline-flex min-h-11 items-center rounded-sm border border-border-contrast px-3 font-medium text-sm text-text-primary"
            data-testid="matrix-remove-today"
            onClick={handleRemove}
            type="button"
          >
            Remove from Today
          </button>
        ) : (
          <button
            className="inline-flex min-h-11 items-center rounded-sm bg-primary px-3 font-semibold text-on-primary text-sm"
            data-testid="matrix-add-today"
            onClick={handleAdd}
            type="button"
          >
            Add to Today ({formatMinutes(task.estimatedMinutes)})
          </button>
        )}
      </div>
    </article>
  );
}

function TodayDockDrop({
  tasks,
  budgetMinutes,
  previewPlanned,
  dockHoverMinutes,
  onHoverMinutes,
}: {
  budgetMinutes: number;
  dockHoverMinutes: number | null;
  onHoverMinutes: (minutes: number | null) => void;
  previewPlanned: number;
  tasks: Task[];
}) {
  const ref = useRef<HTMLElement>(null);
  const [isOver, setIsOver] = useState(false);
  const todayTasks = getTodayTasks(tasks);
  const tone = capacityTone(previewPlanned, budgetMinutes);
  const percent = Math.round((previewPlanned / budgetMinutes) * 100);
  const toneTextClass = capacityToneTextClass(tone);
  const toneBarClass = capacityToneBarClass(tone);

  useEffect(() => {
    const element = ref.current as HTMLElement | null;
    if (!element) {
      return;
    }
    return dropTargetForElements({
      canDrop: ({ source }) => isTaskDrag(source.data),
      element,
      getData: () => ({ dropType: "today" }),
      onDragEnter: ({ source }) => {
        setIsOver(true);
        if (isTaskDrag(source.data)) {
          const draggedId = taskIdFromData(source.data);
          const task = tasks.find((item) => item.id === draggedId);
          if (task && !task.isToday) {
            onHoverMinutes(task.estimatedMinutes);
          }
        }
      },
      onDragLeave: () => {
        setIsOver(false);
        onHoverMinutes(null);
      },
      onDrop: () => {
        setIsOver(false);
        onHoverMinutes(null);
      },
    });
  }, [onHoverMinutes, tasks]);

  return (
    <aside
      aria-label="Today dock"
      className={`flex w-72 shrink-0 flex-col gap-4 border-l bg-surface-subtle p-4 ${
        isOver ? "border-primary" : "border-border-contrast"
      }`}
      ref={ref}
    >
      <div>
        <h2 className="font-semibold text-sm text-text-primary">
          Today's Runway
        </h2>
        <p className="mt-1 font-mono text-text-muted text-xs">
          {todayTasks.length} staged
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-text-muted">Capacity</span>
          <span className={toneTextClass}>
            {percent}%{dockHoverMinutes === null ? "" : " preview"}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div
            className={`h-full rounded-full ${toneBarClass}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>

      <div
        className={`flex min-h-24 flex-col items-center justify-center rounded-sm border border-dashed px-3 py-4 text-center ${
          isOver
            ? "border-primary bg-primary/10"
            : "border-border-contrast bg-canvas/40"
        }`}
      >
        <p className="font-medium text-sm text-text-secondary">
          Drop task to schedule for Today
        </p>
        <p className="mt-1 font-mono text-text-muted text-xs">
          Sets Today flag only — quadrant unchanged
        </p>
      </div>

      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {todayTasks.map((task) => {
          const q = getTaskQuadrant(task);
          const meta = QUADRANT_META[q];
          return (
            <li
              className="rounded-sm border border-border-contrast bg-surface px-3 py-2"
              key={task.id}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: meta.colorVar }}
                />
                <p className="line-clamp-2 font-medium text-sm text-text-primary">
                  {task.title}
                </p>
              </div>
              <p className="tabular-metrics mt-1 font-mono text-text-muted text-xs">
                {q} · {formatMinutes(task.estimatedMinutes)}
              </p>
            </li>
          );
        })}
      </ul>

      <a
        className="flex min-h-11 items-center justify-center rounded-sm bg-primary font-semibold text-on-primary text-sm"
        href="/today"
      >
        Open Today board
      </a>
    </aside>
  );
}
