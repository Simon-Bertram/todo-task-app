import { useMemo } from "preact/hooks";
import {
  COMPLETED_RANGE_OPTIONS,
  type CompletedRangeId,
  emptyStateForRange,
  formatCompletedAt,
} from "../../lib/completed-range";
import { getQuadrant, QUADRANT_META } from "../../lib/quadrant";
import { getProject, type Project, type Task } from "../../lib/task-helpers";

interface Props {
  projects: Project[];
  range: CompletedRangeId;
  tasks: Task[];
  timeZone: string;
}

export default function CompleteBoard({
  tasks,
  projects,
  range,
  timeZone,
}: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const label = formatCompletedAt(task.completedAt, timeZone) || "Unknown";
      const dayKey = label.split(",")[0] ?? label;
      const list = map.get(dayKey) ?? [];
      list.push(task);
      map.set(dayKey, list);
    }
    return [...map.entries()];
  }, [tasks, timeZone]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 lg:px-8">
      <header className="space-y-4">
        <div>
          <p className="font-mono text-text-muted text-xs uppercase tracking-wide">
            Archive
          </p>
          <h1 className="mt-1 font-semibold text-2xl text-text-primary tracking-tight sm:text-3xl">
            Complete
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Finished work for reflection — not a scoreboard.
          </p>
        </div>

        <div
          aria-label="Completion range"
          className="flex gap-1 overflow-x-auto rounded-full border border-border-subtle bg-surface-subtle p-1"
          role="tablist"
        >
          {COMPLETED_RANGE_OPTIONS.map((option) => {
            const selected = option.id === range;
            return (
              <a
                aria-selected={selected}
                className={
                  selected
                    ? "inline-flex min-h-10 shrink-0 items-center rounded-full bg-surface-elevated px-3 font-medium text-sm text-text-primary"
                    : "inline-flex min-h-10 shrink-0 items-center rounded-full px-3 font-medium text-sm text-text-secondary hover:text-text-primary"
                }
                href={`/complete?range=${option.id}&tz=${encodeURIComponent(timeZone)}`}
                key={option.id}
                role="tab"
              >
                {option.label}
              </a>
            );
          })}
        </div>
      </header>

      {tasks.length === 0 ? (
        <p className="rounded-sm border border-border-contrast border-dashed px-4 py-10 text-center text-sm text-text-muted">
          {emptyStateForRange(range)}
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, dayTasks]) => (
            <section className="space-y-2" key={day}>
              <h2 className="font-mono text-text-muted text-xs uppercase tracking-wide">
                {day}
              </h2>
              <ul className="space-y-2">
                {dayTasks.map((task) => {
                  const project = getProject(projects, task.projectId);
                  const quadrant = getQuadrant(task.isUrgent, task.isImportant);
                  const meta = QUADRANT_META[quadrant];
                  return (
                    <li key={task.id}>
                      <button
                        className="task-open flex min-h-11 w-full items-start gap-3 rounded-sm border border-border-contrast bg-surface px-3 py-3 text-left hover:bg-surface-elevated"
                        data-task-id={task.id}
                        type="button"
                      >
                        <span
                          className={`mt-1 size-2 shrink-0 rounded-full ${meta.accentClass.replace("accent-", "bg-")}`}
                          style={{ backgroundColor: meta.colorVar }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-sm text-text-primary">
                            {task.title}
                          </span>
                          <span className="mt-0.5 block font-mono text-text-muted text-xs">
                            {meta.id}
                            {project ? ` · #${project.name}` : ""}
                            {" · "}
                            {formatCompletedAt(task.completedAt, timeZone)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
