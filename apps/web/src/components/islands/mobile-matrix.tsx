import { useCallback, useState } from "preact/hooks";
import type { MockTask } from "../../lib/mock-data";
import {
  formatMinutes,
  QUADRANT_META,
  type QuadrantId,
} from "../../lib/quadrant";

interface ProjectRef {
  color: string;
  id: string;
  name: string;
}

interface Props {
  backlogCount: number;
  budgetMinutes: number;
  plannedMinutes: number;
  projects: ProjectRef[];
  tasksByQuadrant: Record<QuadrantId, MockTask[]>;
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
  tasksByQuadrant,
  projects,
  plannedMinutes,
  budgetMinutes,
  todayCount,
  backlogCount,
}: Props) {
  const [selected, setSelected] = useState<QuadrantId>("Q1");
  const tasks = tasksByQuadrant[selected];
  const meta = QUADRANT_META[selected];
  const remaining = Math.max(budgetMinutes - plannedMinutes, 0);
  const percent = Math.round((plannedMinutes / budgetMinutes) * 100);

  const onTabClick = useCallback((event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const id = button.dataset.quadrant as QuadrantId | undefined;
    if (id) {
      setSelected(id);
    }
  }, []);

  function projectFor(id: string | null): ProjectRef | undefined {
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
            No tasks in {selected}. Move items here from other quadrants later.
          </li>
        ) : (
          tasks.map((task) => {
            const project = projectFor(task.projectId);
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
                  </div>
                  {task.isToday ? null : (
                    <button
                      className="mt-3 inline-flex min-h-11 items-center rounded-sm bg-primary px-3 font-semibold text-on-primary text-sm"
                      data-add-today={task.id}
                      type="button"
                    >
                      + Add to Today ({formatMinutes(task.estimatedMinutes)})
                    </button>
                  )}
                </article>
              </li>
            );
          })
        )}
      </ul>

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
