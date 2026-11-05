import type { TasksBoardPrefs } from "@todo-task-app/api/schemas/tasks-board-prefs";
import { DEFAULT_TASKS_BOARD_PREFS } from "@todo-task-app/api/schemas/tasks-board-prefs";
import { useCallback, useMemo } from "preact/hooks";
import { countDueReminders } from "../../lib/due-date";
import {
  filterTasksList,
  getLocalDateString,
  hasActiveTasksBoardFilters,
  type Project,
  sortTasksList,
  type Task,
  type TaskProgressControl,
} from "../../lib/task-helpers";
import { useTasksBoardPrefs } from "../../lib/use-tasks-board-prefs";
import { TaskListRow } from "./task-list-row";

interface Props {
  initialPrefs: TasksBoardPrefs;
  initialQuery: string;
  projects: Project[];
  taskProgressControl?: TaskProgressControl;
  tasks: Task[];
}

const SELECT_CLASS =
  "min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 text-sm text-text-primary focus:border-primary focus:outline-none";

const DUE_LABELS: Record<TasksBoardPrefs["due"], string> = {
  all: "All due dates",
  none: "No due date",
  overdue: "Overdue",
  today: "Due today",
  upcoming: "Upcoming",
};

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

function parsePriorityMin(value: string): TasksBoardPrefs["importanceMin"] {
  if (value === "any") {
    return null;
  }
  const parsed = Number(value);
  if (parsed === 1 || parsed === 2 || parsed === 3) {
    return parsed;
  }
  return null;
}

export default function TasksBoard({
  tasks,
  projects,
  initialPrefs,
  initialQuery,
  taskProgressControl = "pie",
}: Props) {
  const { prefs, query, setPrefs, setQuery, updatePrefs } = useTasksBoardPrefs(
    initialPrefs,
    initialQuery
  );

  const visibleTasks = useMemo(() => {
    const filtered = filterTasksList(tasks, projects, {
      due: prefs.due,
      importanceMin: prefs.importanceMin,
      project: prefs.project,
      query,
      urgencyMin: prefs.urgencyMin,
    });
    return sortTasksList(filtered, prefs.sort);
  }, [prefs, projects, query, tasks]);

  const filtersActive = hasActiveTasksBoardFilters(prefs, query);

  const projectLabel = useMemo(() => {
    if (prefs.project === null) {
      return null;
    }
    if (prefs.project === "inbox") {
      return "Inbox";
    }
    const project = projects.find((item) => item.id === prefs.project);
    return project ? `#${project.name}` : null;
  }, [prefs.project, projects]);

  const onSearchInput = useCallback(
    (event: Event) => {
      const { value } = event.currentTarget as HTMLInputElement;
      setQuery(value);
    },
    [setQuery]
  );

  const onProjectChange = useCallback(
    (event: Event) => {
      const { value } = event.currentTarget as HTMLSelectElement;
      updatePrefs({
        project: value === "all" ? null : value,
      });
    },
    [updatePrefs]
  );

  const onDueChange = useCallback(
    (event: Event) => {
      const { value } = event.currentTarget as HTMLSelectElement;
      updatePrefs({ due: value as TasksBoardPrefs["due"] });
    },
    [updatePrefs]
  );

  const onImportanceChange = useCallback(
    (event: Event) => {
      const { value } = event.currentTarget as HTMLSelectElement;
      updatePrefs({ importanceMin: parsePriorityMin(value) });
    },
    [updatePrefs]
  );

  const onUrgencyChange = useCallback(
    (event: Event) => {
      const { value } = event.currentTarget as HTMLSelectElement;
      updatePrefs({ urgencyMin: parsePriorityMin(value) });
    },
    [updatePrefs]
  );

  const onSortChange = useCallback(
    (event: Event) => {
      const { value } = event.currentTarget as HTMLSelectElement;
      updatePrefs({ sort: value as TasksBoardPrefs["sort"] });
    },
    [updatePrefs]
  );

  const clearProject = useCallback(() => {
    updatePrefs({ project: null });
  }, [updatePrefs]);

  const clearDue = useCallback(() => {
    updatePrefs({ due: "all" });
  }, [updatePrefs]);

  const clearImportance = useCallback(() => {
    updatePrefs({ importanceMin: null });
  }, [updatePrefs]);

  const clearUrgency = useCallback(() => {
    updatePrefs({ urgencyMin: null });
  }, [updatePrefs]);

  const clearQuery = useCallback(() => {
    setQuery("");
  }, [setQuery]);

  const clearFilters = useCallback(() => {
    setPrefs((current) => ({
      ...DEFAULT_TASKS_BOARD_PREFS,
      sort: current.sort,
    }));
    setQuery("");
  }, [setPrefs, setQuery]);

  const openQuickAdd = useCallback(() => {
    document.dispatchEvent(new CustomEvent("plansage:quick-add"));
  }, []);

  const dueBannerParts = useMemo(() => buildDueBannerParts(tasks), [tasks]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-semibold text-2xl text-text-primary tracking-tight">
            Tasks
          </h1>
          <p className="text-sm text-text-secondary">
            Search and filter all open tasks. Sort and filters are saved to your
            account.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 shrink-0 items-center rounded-sm bg-primary px-4 font-semibold text-on-primary text-sm"
          onClick={openQuickAdd}
          type="button"
        >
          Add task
        </button>
      </header>

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

      <TasksFiltersForm
        onDueChange={onDueChange}
        onImportanceChange={onImportanceChange}
        onProjectChange={onProjectChange}
        onSearchInput={onSearchInput}
        onSortChange={onSortChange}
        onUrgencyChange={onUrgencyChange}
        prefs={prefs}
        projects={projects}
        query={query}
      />

      <ActiveFilterChips
        clearDue={clearDue}
        clearFilters={clearFilters}
        clearImportance={clearImportance}
        clearProject={clearProject}
        clearQuery={clearQuery}
        clearUrgency={clearUrgency}
        filtersActive={filtersActive}
        prefs={prefs}
        projectLabel={projectLabel}
        query={query}
        visibleCount={visibleTasks.length}
      />

      {visibleTasks.length === 0 ? (
        <div className="space-y-4 rounded-md border border-border-contrast bg-surface p-6">
          <p className="text-sm text-text-secondary">
            {filtersActive
              ? "No tasks match these filters."
              : "No tasks yet. Capture one to get started."}
          </p>
          {filtersActive ? null : (
            <button
              className="inline-flex min-h-11 items-center rounded-sm bg-primary px-4 font-semibold text-on-primary text-sm"
              onClick={openQuickAdd}
              type="button"
            >
              Add task
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {visibleTasks.map((task) => (
            <TaskListRow
              control={taskProgressControl}
              key={task.id}
              projects={projects}
              task={task}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TasksFiltersForm({
  prefs,
  projects,
  query,
  onSearchInput,
  onProjectChange,
  onDueChange,
  onImportanceChange,
  onUrgencyChange,
  onSortChange,
}: {
  onDueChange: (event: Event) => void;
  onImportanceChange: (event: Event) => void;
  onProjectChange: (event: Event) => void;
  onSearchInput: (event: Event) => void;
  onSortChange: (event: Event) => void;
  onUrgencyChange: (event: Event) => void;
  prefs: TasksBoardPrefs;
  projects: Project[];
  query: string;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border-contrast bg-surface p-4">
      <label className="block space-y-1.5">
        <span className="font-medium text-sm text-text-secondary">Search</span>
        <input
          className={SELECT_CLASS}
          onInput={onSearchInput}
          placeholder="Search title or project…"
          type="search"
          value={query}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="font-medium text-sm text-text-secondary">
            Project
          </span>
          <select
            className={SELECT_CLASS}
            onChange={onProjectChange}
            value={prefs.project ?? "all"}
          >
            <option value="all">All projects</option>
            <option value="inbox">Inbox</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                #{project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="font-medium text-sm text-text-secondary">
            Due date
          </span>
          <select
            className={SELECT_CLASS}
            onChange={onDueChange}
            value={prefs.due}
          >
            <option value="all">All</option>
            <option value="overdue">Overdue</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="none">No due date</option>
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="font-medium text-sm text-text-secondary">
            Importance
          </span>
          <select
            className={SELECT_CLASS}
            onChange={onImportanceChange}
            value={
              prefs.importanceMin === null ? "any" : String(prefs.importanceMin)
            }
          >
            <option value="any">Any</option>
            <option value="1">≥ 1</option>
            <option value="2">≥ 2</option>
            <option value="3">≥ 3</option>
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="font-medium text-sm text-text-secondary">
            Urgency
          </span>
          <select
            className={SELECT_CLASS}
            onChange={onUrgencyChange}
            value={prefs.urgencyMin === null ? "any" : String(prefs.urgencyMin)}
          >
            <option value="any">Any</option>
            <option value="1">≥ 1</option>
            <option value="2">≥ 2</option>
            <option value="3">≥ 3</option>
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="font-medium text-sm text-text-secondary">Sort</span>
          <select
            className={SELECT_CLASS}
            onChange={onSortChange}
            value={prefs.sort}
          >
            <option value="due">Due date</option>
            <option value="importance">Importance</option>
            <option value="urgency">Urgency</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function ActiveFilterChips({
  visibleCount,
  filtersActive,
  projectLabel,
  prefs,
  query,
  clearProject,
  clearDue,
  clearImportance,
  clearUrgency,
  clearQuery,
  clearFilters,
}: {
  clearDue: () => void;
  clearFilters: () => void;
  clearImportance: () => void;
  clearProject: () => void;
  clearQuery: () => void;
  clearUrgency: () => void;
  filtersActive: boolean;
  prefs: TasksBoardPrefs;
  projectLabel: string | null;
  query: string;
  visibleCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="tabular-metrics font-mono text-text-muted text-xs">
        {visibleCount} task{visibleCount === 1 ? "" : "s"}
      </p>

      {filtersActive ? (
        <>
          {projectLabel ? (
            <FilterChip
              label={`Project: ${projectLabel}`}
              onClear={clearProject}
            />
          ) : null}
          {prefs.due === "all" ? null : (
            <FilterChip label={DUE_LABELS[prefs.due]} onClear={clearDue} />
          )}
          {prefs.importanceMin === null ? null : (
            <FilterChip
              label={`Importance ≥ ${prefs.importanceMin}`}
              onClear={clearImportance}
            />
          )}
          {prefs.urgencyMin === null ? null : (
            <FilterChip
              label={`Urgency ≥ ${prefs.urgencyMin}`}
              onClear={clearUrgency}
            />
          )}
          {query.trim() ? (
            <FilterChip
              label={`Search: ${query.trim()}`}
              onClear={clearQuery}
            />
          ) : null}
          <button
            className="inline-flex min-h-9 items-center rounded-sm px-2 font-medium text-primary text-xs hover:underline"
            onClick={clearFilters}
            type="button"
          >
            Clear all
          </button>
        </>
      ) : null}
    </div>
  );
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <button
      aria-label={`Clear filter ${label}`}
      className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-border-contrast bg-surface-subtle px-3 font-mono text-[11px] text-text-secondary hover:bg-surface-elevated"
      onClick={onClear}
      type="button"
    >
      <span className="truncate">{label}</span>
      <span aria-hidden="true">×</span>
    </button>
  );
}
