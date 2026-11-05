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
  celebrateTaskComplete,
  completionIntensity,
} from "../../lib/celebrate";
import { countDueReminders } from "../../lib/due-date";
import { orpc } from "../../lib/orpc";
import {
  type CapacityBucket,
  capacityTone,
  capacityToneBarClass,
  capacityToneTextClass,
  formatMinutes,
  getCapacityBucket,
  QUADRANT_META,
} from "../../lib/quadrant";
import { stopPointerPropagation } from "../../lib/stop-pointer";
import {
  getLocalDateString,
  getProject,
  getTaskQuadrant,
  getTodayExecutionProgress,
  getTodayPlannedMinutes,
  getTodayTasks,
  isLongTask,
  type Project,
  type Task,
  type TaskProgressControl,
} from "../../lib/task-helpers";
import { showToast } from "../../lib/toast";
import {
  useOptimisticTaskUpdate,
  useTodayFlag,
} from "../../lib/use-task-mutations";
import {
  useIsDesktopLg,
  useTaskProgressSync,
} from "../../lib/use-task-progress-sync";
import { TaskMetaChips } from "./task-meta-chips";
import TaskProgress from "./task-progress";

interface Props {
  budgetMinutes: number;
  projects: Project[];
  taskProgressControl?: TaskProgressControl;
  tasks: Task[];
}

const BUCKET_META: Record<
  Exclude<CapacityBucket, "other">,
  { hint: string; slotIds: string[]; title: string }
> = {
  major: {
    hint: "1 slot · 60–120m deep work",
    slotIds: ["major-1"],
    title: "1 Major",
  },
  medium: {
    hint: "3 slots · 30–60m",
    slotIds: ["medium-1", "medium-2", "medium-3"],
    title: "3 Medium",
  },
  quick: {
    hint: "5 slots · under 15m",
    slotIds: ["quick-1", "quick-2", "quick-3", "quick-4", "quick-5"],
    title: "5 Quick wins",
  },
};

function isReorderDrag(data: Record<string | symbol, unknown>): boolean {
  return data.type === "today-reorder" && typeof data.taskId === "string";
}

function reorderTaskId(data: Record<string | symbol, unknown>): string | null {
  return typeof data.taskId === "string" ? data.taskId : null;
}

function buildDueBannerParts(tasks: Task[]): string[] {
  const counts = countDueReminders(tasks, getLocalDateString());
  const parts: string[] = [];
  if (counts.overdue > 0) {
    parts.push(`${counts.overdue} overdue`);
  }
  if (counts.today > 0) {
    parts.push(`${counts.today} due today`);
  }
  if (counts.soon > 0) {
    parts.push(`${counts.soon} due within 2 days`);
  }
  return parts;
}

export default function TodayBoard({
  tasks: initialTasks,
  projects,
  budgetMinutes,
  taskProgressControl = "pie",
}: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [busyId, setBusyId] = useState<string | null>(null);
  useTaskProgressSync(setTasks);
  const isDesktop = useIsDesktopLg();
  const isBusy = busyId !== null;
  const updateTask = useOptimisticTaskUpdate(
    tasks,
    setTasks,
    isBusy,
    setBusyId
  );
  const { removeFromToday } = useTodayFlag(updateTask);
  const todayTasks = useMemo(() => getTodayTasks(tasks), [tasks]);
  const plannedMinutes = getTodayPlannedMinutes(tasks);
  const tone = capacityTone(plannedMinutes, budgetMinutes);
  const todayCount = todayTasks.length;
  const execution = useMemo(() => getTodayExecutionProgress(tasks), [tasks]);
  const dayProtected =
    execution.dayProtected && plannedMinutes <= budgetMinutes;

  const buckets = useMemo(() => {
    const groups: Record<CapacityBucket, Task[]> = {
      major: [],
      medium: [],
      other: [],
      quick: [],
    };
    for (const task of todayTasks) {
      groups[getCapacityBucket(task.estimatedMinutes)].push(task);
    }
    return groups;
  }, [todayTasks]);

  const qMinutes = useMemo(() => {
    const minutes = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    for (const task of todayTasks) {
      minutes[getTaskQuadrant(task)] += task.estimatedMinutes;
    }
    return minutes;
  }, [todayTasks]);

  const reorder = useCallback(
    async (activeId: string, overId: string) => {
      if (activeId === overId || isBusy) {
        return;
      }
      const ordered = getTodayTasks(tasks);
      const fromIndex = ordered.findIndex((task) => task.id === activeId);
      const toIndex = ordered.findIndex((task) => task.id === overId);
      if (fromIndex < 0 || toIndex < 0) {
        return;
      }
      const nextOrder = [...ordered];
      const [moved] = nextOrder.splice(fromIndex, 1);
      if (!moved) {
        return;
      }
      nextOrder.splice(toIndex, 0, moved);
      const previous = tasks;
      const withSort = nextOrder.map((task, index) => ({
        ...task,
        sortOrder: index,
      }));
      setBusyId(activeId);
      setTasks((current) => {
        const map = new Map(withSort.map((task) => [task.id, task]));
        return current.map((task) => map.get(task.id) ?? task);
      });
      try {
        await Promise.all(
          withSort.map((task) =>
            orpc.tasks.update({ id: task.id, sortOrder: task.sortOrder })
          )
        );
      } catch {
        setTasks(previous);
        showToast("Could not reorder Today. Try again.", "error");
      } finally {
        setBusyId(null);
      }
    },
    [isBusy, tasks]
  );

  const completeTask = useCallback(
    async (taskId: string) => {
      const target = tasks.find((task) => task.id === taskId);
      if (!target || isBusy) {
        return;
      }
      const previous = tasks;
      const remainingTodayCount = tasks.filter(
        (task) => task.isToday && !task.isCompleted && task.id !== taskId
      ).length;
      setBusyId(taskId);
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, isCompleted: true } : task
        )
      );
      try {
        const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
        const result = await orpc.tasks.update({
          id: taskId,
          isCompleted: true,
          timeZone,
        });
        await celebrateTaskComplete(
          completionIntensity({
            budgetMinutes,
            estimatedMinutes: target.estimatedMinutes,
            isToday: target.isToday,
            plannedMinutes,
            remainingTodayCount,
          })
        );
        if (result.unlockedMilestones && result.unlockedMilestones.length > 0) {
          showToast("Milestone unlocked", "success");
        } else {
          showToast("Task completed", "success");
        }
      } catch {
        setTasks(previous);
        showToast("Could not complete task. Try again.", "error");
      } finally {
        setBusyId(null);
      }
    },
    [budgetMinutes, isBusy, plannedMinutes, tasks]
  );

  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => isReorderDrag(source.data),
        onDrop: ({ source, location }) => {
          const [target] = location.current.dropTargets;
          const activeId = reorderTaskId(source.data);
          if (!(target && isReorderDrag(source.data) && activeId)) {
            return;
          }
          if (
            target.data.dropType === "today-task" &&
            typeof target.data.taskId === "string"
          ) {
            reorder(activeId, target.data.taskId).catch(() => undefined);
          }
        },
      }),
    [reorder]
  );

  const dueBannerParts = buildDueBannerParts(tasks);
  const textClass = capacityToneTextClass(tone);
  const barClass = capacityToneBarClass(tone);
  const capacityPercent = Math.round((plannedMinutes / budgetMinutes) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 lg:px-8">
      <header className="space-y-4">
        <div>
          <p className="font-mono text-text-muted text-xs uppercase tracking-wide">
            Daily execution
          </p>
          <h1 className="mt-1 font-semibold text-2xl text-text-primary tracking-tight sm:text-3xl">
            Daily Execution Board
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            1-3-5 capacity allocation · {todayCount} tasks staged
          </p>
        </div>

        {dueBannerParts.length > 0 ? (
          <div
            className="rounded-md border border-capacity-warn/40 bg-capacity-warn/10 px-4 py-3 text-sm text-text-primary"
            role="status"
          >
            <p className="font-medium">Due reminders</p>
            <p className="mt-0.5 text-text-secondary">
              {dueBannerParts.join(" · ")}
            </p>
          </div>
        ) : null}

        <div className="sticky top-14 z-20 space-y-3 rounded-md border border-border-contrast bg-canvas/95 p-4 backdrop-blur-md lg:top-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-text-muted">Capacity</span>
              <span className={textClass}>{capacityPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <div
                className={`h-full rounded-full ${barClass}`}
                style={{
                  width: `${Math.min(capacityPercent, 100)}%`,
                }}
              />
            </div>
            <p className="tabular-metrics font-mono text-text-muted text-xs">
              {formatMinutes(plannedMinutes)} / {formatMinutes(budgetMinutes)}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-text-muted">Done today</span>
              <span className="text-text-secondary">{execution.percent}%</span>
            </div>
            <div
              aria-label="Done today"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={execution.percent}
              className="h-1.5 overflow-hidden rounded-full bg-surface"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-capacity-ok transition-all"
                style={{ width: `${Math.min(execution.percent, 100)}%` }}
              />
            </div>
            <p className="tabular-metrics font-mono text-text-muted text-xs">
              {formatMinutes(execution.completedMinutes)} /{" "}
              {formatMinutes(execution.stagedMinutes)} staged ·{" "}
              {execution.completedCount}/{execution.stagedCount} tasks
            </p>
          </div>
          <div className="flex flex-wrap gap-3 font-mono text-text-muted text-xs">
            <span>Q1: {formatMinutes(qMinutes.Q1)}</span>
            <span>Q2: {formatMinutes(qMinutes.Q2)}</span>
            <span>Q3: {formatMinutes(qMinutes.Q3)}</span>
          </div>
          {dayProtected ? (
            <p
              className="rounded-sm border border-capacity-ok/40 bg-capacity-ok/10 px-3 py-2 text-capacity-ok text-sm"
              role="status"
            >
              Day protected — you finished what fit today.
            </p>
          ) : null}
          {tone === "warn" ? (
            <p className="rounded-sm border border-capacity-warn/40 bg-capacity-warn/10 px-3 py-2 text-capacity-warn text-sm">
              Approaching daily budget. Adding another major task may breach{" "}
              {(budgetMinutes / 60).toFixed(0)}h.
            </p>
          ) : null}
          {tone === "over" ? (
            <p className="rounded-sm border border-capacity-over/40 bg-capacity-over/10 px-3 py-2 text-capacity-over text-sm">
              Over capacity — remove a task from Today or raise your daily
              budget in Settings.
            </p>
          ) : null}
        </div>
      </header>

      {(["major", "medium", "quick"] as const).map((bucket) => {
        const meta = BUCKET_META[bucket];
        const items = buckets[bucket];
        return (
          <section className="space-y-3" key={bucket}>
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 className="font-semibold text-lg text-text-primary">
                  {meta.title}
                </h2>
                <p className="text-sm text-text-secondary">{meta.hint}</p>
              </div>
              <span className="tabular-metrics font-mono text-text-muted text-xs">
                {items.length}/{meta.slotIds.length} filled
              </span>
            </div>
            <div className="flex gap-1">
              {meta.slotIds.map((slotId, slotNumber) => (
                <span
                  aria-hidden="true"
                  className={
                    slotNumber < items.length
                      ? "h-1.5 flex-1 rounded-full bg-capacity-ok"
                      : "h-1.5 flex-1 rounded-full bg-surface"
                  }
                  key={slotId}
                />
              ))}
            </div>
            <ul className="space-y-2">
              {items.length === 0 ? (
                <li className="rounded-sm border border-border-contrast border-dashed px-4 py-8 text-center text-sm text-text-muted">
                  Empty slot — drag from Matrix or reorder here.
                </li>
              ) : (
                items.map((task) => (
                  <TodayTaskRow
                    busy={busyId === task.id}
                    control={taskProgressControl}
                    interactive={isDesktop}
                    key={task.id}
                    onComplete={completeTask}
                    onRemove={removeFromToday}
                    projects={projects}
                    task={task}
                  />
                ))
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TodayTaskRow({
  task,
  projects,
  control,
  interactive,
  busy,
  onComplete,
  onRemove,
}: {
  busy: boolean;
  control: TaskProgressControl;
  interactive: boolean;
  onComplete: (taskId: string) => void;
  onRemove: (taskId: string) => void;
  projects: Project[];
  task: Task;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const [dragging, setDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const quadrant = getTaskQuadrant(task);
  const meta = QUADRANT_META[quadrant];
  const project = getProject(projects, task.projectId);
  const today = getLocalDateString();
  const showProgress = isLongTask(task.estimatedMinutes);

  useEffect(() => {
    const element = ref.current as HTMLLIElement | null;
    if (!element) {
      return;
    }
    const cleanupDrag = draggable({
      element,
      getInitialData: () => ({ taskId: task.id, type: "today-reorder" }),
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
    const cleanupDrop = dropTargetForElements({
      canDrop: ({ source }) =>
        isReorderDrag(source.data) && reorderTaskId(source.data) !== task.id,
      element,
      getData: () => ({ dropType: "today-task", taskId: task.id }),
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: () => setIsOver(false),
    });
    return () => {
      cleanupDrag();
      cleanupDrop();
    };
  }, [task.id]);

  const handleComplete = useCallback(() => {
    onComplete(task.id);
  }, [onComplete, task.id]);

  const handleRemove = useCallback(() => {
    onRemove(task.id);
  }, [onRemove, task.id]);

  return (
    <li
      className={`rounded-sm border bg-surface p-4 pl-4 ${meta.accentClass} ${
        isOver ? "border-primary" : "border-border-contrast"
      } ${dragging ? "opacity-60" : ""}`}
      ref={ref}
    >
      <div className="flex items-start gap-3">
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
              interactive={interactive}
              progressPercent={task.progressPercent}
              size={interactive ? "inline" : "compact"}
              taskId={task.id}
            />
          </div>
        ) : null}
      </div>

      <TaskMetaChips
        project={project}
        showQuadrant
        showTodayChip={false}
        task={task}
        today={today}
      />

      {showProgress && control === "slider" ? (
        <div className="mt-3" onPointerDown={stopPointerPropagation}>
          <TaskProgress
            control={control}
            interactive={interactive}
            progressPercent={task.progressPercent}
            size={interactive ? "inline" : "compact"}
            taskId={task.id}
          />
        </div>
      ) : null}

      <div
        className="mt-3 flex flex-wrap gap-2"
        onPointerDown={stopPointerPropagation}
      >
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-sm bg-primary px-3 font-semibold text-on-primary text-sm disabled:opacity-60"
          data-testid="today-complete"
          disabled={busy}
          onClick={handleComplete}
          type="button"
        >
          Mark as Completed
        </button>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-sm border border-border-contrast px-3 font-medium text-sm text-text-primary disabled:opacity-60"
          data-testid="today-remove"
          disabled={busy}
          onClick={handleRemove}
          type="button"
        >
          Remove from Today
        </button>
      </div>
      <p className="mt-2 font-mono text-text-muted text-xs">
        Drag to reorder within Today
      </p>
    </li>
  );
}
