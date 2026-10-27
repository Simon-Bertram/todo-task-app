import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type { MockProject, MockTask } from "../../lib/mock-data";
import {
  capacityTone,
  formatMinutes,
  getQuadrant,
  QUADRANT_META,
} from "../../lib/quadrant";

interface Props {
  budgetMinutes: number;
  plannedMinutes: number;
  projects: MockProject[];
  tasks: MockTask[];
}

const ETC_PRESETS = [15, 30, 60, 90, 120] as const;
const RATING = [0, 1, 2, 3] as const;
const RECURRENCE = ["None", "Daily", "Weekdays", "Weekly"] as const;

export default function TaskDetailSheet({
  tasks,
  projects,
  plannedMinutes,
  budgetMinutes,
}: Props) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const baseTask = useMemo(
    () => tasks.find((task) => task.id === taskId) ?? null,
    [taskId, tasks]
  );

  const [isUrgent, setIsUrgent] = useState(0);
  const [isImportant, setIsImportant] = useState(0);
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [recurrence, setRecurrence] =
    useState<(typeof RECURRENCE)[number]>("None");
  const [isToday, setIsToday] = useState(false);

  useEffect(() => {
    function onOpen(event: Event) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest?.(".task-open") as HTMLElement | null;
      const id = button?.dataset.taskId;
      if (id) {
        setTaskId(id);
      }
    }

    document.addEventListener("click", onOpen);
    return () => {
      document.removeEventListener("click", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!baseTask) {
      return;
    }
    setIsUrgent(baseTask.isUrgent);
    setIsImportant(baseTask.isImportant);
    setEstimatedMinutes(baseTask.estimatedMinutes);
    setIsToday(baseTask.isToday);
    setRecurrence("None");
  }, [baseTask]);

  const close = useCallback(() => {
    setTaskId(null);
  }, []);

  const markToday = useCallback(() => {
    setIsToday(true);
  }, []);

  const onEtcClick = useCallback((event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    setEstimatedMinutes(Number(button.dataset.etc));
  }, []);

  const onRecurrenceClick = useCallback((event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const value = button.dataset.recurrence as
      | (typeof RECURRENCE)[number]
      | undefined;
    if (value) {
      setRecurrence(value);
    }
  }, []);

  if (!baseTask) {
    return null;
  }

  const quadrant = getQuadrant(isUrgent, isImportant);
  const meta = QUADRANT_META[quadrant];
  const project = projects.find((item) => item.id === baseTask.projectId);
  const projectedPlanned = isToday
    ? plannedMinutes
    : plannedMinutes + estimatedMinutes;
  const remaining = Math.max(budgetMinutes - plannedMinutes, 0);
  const overBy = projectedPlanned - budgetMinutes;
  const showOverWarning = !isToday && overBy > 0;
  const tone = capacityTone(projectedPlanned, budgetMinutes);

  return (
    <div
      aria-labelledby="task-detail-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      role="dialog"
    >
      <button
        aria-label="Close task detail"
        className="absolute inset-0 cursor-default"
        onClick={close}
        type="button"
      />
      <div className="relative z-10 flex max-h-[92svh] w-full max-w-lg flex-col overflow-y-auto rounded-t-md border border-border-contrast bg-surface sm:rounded-md">
        <header className="sticky top-0 z-10 flex items-center justify-between border-border-contrast border-b bg-surface px-4 py-3">
          <h2
            className="font-semibold text-sm text-text-secondary"
            id="task-detail-title"
          >
            Task detail
          </h2>
          <button
            aria-label="Close"
            className="flex size-11 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
            onClick={close}
            type="button"
          >
            ✕
          </button>
        </header>

        <div className="space-y-6 px-4 py-5">
          {project ? (
            <p
              className="font-mono text-xs uppercase tracking-wide"
              style={{ color: project.color }}
            >
              #{project.name}
            </p>
          ) : null}
          <h3 className="font-semibold text-text-primary text-xl tracking-tight">
            {baseTask.title}
          </h3>

          <section className="space-y-3 rounded-sm border border-border-contrast bg-surface-subtle p-3">
            <div className="flex items-center justify-between gap-2">
              <div
                className="inline-flex items-center gap-2 rounded-sm border px-2.5 py-1.5 font-medium text-sm"
                style={{
                  backgroundColor: `color-mix(in srgb, ${meta.colorVar} 12%, transparent)`,
                  borderColor: `color-mix(in srgb, ${meta.colorVar} 35%, transparent)`,
                  color: meta.colorVar,
                }}
              >
                {quadrant} {meta.label}
              </div>
              <span className="font-mono text-text-muted text-xs">
                Matrix calculus
              </span>
            </div>

            <RatingRow
              label="Urgency"
              onChange={setIsUrgent}
              value={isUrgent}
            />
            <RatingRow
              label="Importance"
              onChange={setIsImportant}
              value={isImportant}
            />
            <p className="rounded-sm bg-canvas/60 px-2 py-1.5 font-mono text-text-muted text-xs">
              Rule: Urgency ≥ 2 AND Importance ≥ 2 = Q1
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-medium text-sm text-text-secondary">
              Estimated time
            </h4>
            <div className="flex flex-wrap gap-2">
              {ETC_PRESETS.map((minutes) => {
                const selected = estimatedMinutes === minutes;
                return (
                  <button
                    className={`min-h-11 rounded-full border px-3 font-mono text-sm ${
                      selected
                        ? "border-primary bg-primary text-on-primary"
                        : "border-border-contrast bg-surface-subtle text-text-secondary"
                    }`}
                    data-etc={minutes}
                    key={minutes}
                    onClick={onEtcClick}
                    type="button"
                  >
                    {formatMinutes(minutes)}
                  </button>
                );
              })}
            </div>
            {showOverWarning ? (
              <p className="rounded-sm border border-capacity-over/40 bg-capacity-over/10 px-3 py-2 text-capacity-over text-sm">
                Adding {formatMinutes(estimatedMinutes)} exceeds the remaining{" "}
                {remaining}m budget by {overBy}m ({tone} load).
              </p>
            ) : null}
          </section>

          <section className="space-y-2">
            <h4 className="font-medium text-sm text-text-secondary">
              Recurrence
            </h4>
            <div className="flex flex-wrap gap-1 rounded-full border border-border-subtle bg-surface-subtle p-1">
              {RECURRENCE.map((rule) => {
                const selected = recurrence === rule;
                return (
                  <button
                    className={`min-h-10 rounded-full px-3 font-medium text-sm ${
                      selected
                        ? "bg-surface-elevated text-text-primary"
                        : "text-text-secondary"
                    }`}
                    data-recurrence={rule}
                    key={rule}
                    onClick={onRecurrenceClick}
                    type="button"
                  >
                    {rule}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="space-y-2 pb-2">
            <button
              className="flex min-h-11 w-full items-center justify-center rounded-sm bg-primary font-semibold text-on-primary text-sm"
              onClick={markToday}
              type="button"
            >
              {isToday ? "On Today's board" : "Schedule to Today's board"}
            </button>
            <button
              className="flex min-h-11 w-full items-center justify-center rounded-sm text-capacity-over text-sm hover:bg-capacity-over/10"
              onClick={close}
              type="button"
            >
              Close / dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  onChange: (next: number) => void;
  value: number;
}) {
  const onClick = useCallback(
    (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      onChange(Number(button.dataset.rating));
    },
    [onChange]
  );

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className="tabular-metrics font-mono text-text-muted text-xs">
          {value}/3
        </span>
      </div>
      <div className="flex gap-1">
        {RATING.map((rating) => {
          const selected = value === rating;
          return (
            <button
              className={`min-h-11 flex-1 rounded-sm border font-mono text-sm ${
                selected
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border-contrast bg-canvas/40 text-text-secondary"
              }`}
              data-rating={rating}
              key={rating}
              onClick={onClick}
              type="button"
            >
              {rating}
            </button>
          );
        })}
      </div>
    </div>
  );
}
