import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { orpc } from "../../lib/orpc";
import { formatMinutes, getQuadrant, QUADRANT_META } from "../../lib/quadrant";
import type { Project, Task } from "../../lib/task-helpers";

interface Props {
  initialFilter: string;
  projects: Project[];
  tasks: Task[];
}

type FilterKey = "all" | "inbox" | string;

type PanelMode =
  | { kind: "closed" }
  | { kind: "project-create" }
  | { kind: "project-edit"; project: Project }
  | { kind: "task-create"; projectId: string | null };

const COLOR_PRESETS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#64748b",
] as const;

function readFilterFromUrl(): FilterKey {
  if (typeof window === "undefined") {
    return "all";
  }
  const raw = new URL(window.location.href).searchParams.get("project");
  if (!raw || raw === "all") {
    return "all";
  }
  return raw;
}

function syncFilterToUrl(filter: FilterKey): void {
  const url = new URL(window.location.href);
  if (filter === "all") {
    url.searchParams.delete("project");
  } else {
    url.searchParams.set("project", filter);
  }
  window.history.replaceState({}, "", url);
}

function filterOpenTasks(tasks: Task[], filter: FilterKey): Task[] {
  const openTasks = tasks.filter((task) => !task.isCompleted);
  if (filter === "all") {
    return openTasks;
  }
  if (filter === "inbox") {
    return openTasks.filter((task) => task.projectId === null);
  }
  return openTasks.filter((task) => task.projectId === filter);
}

export default function ProjectBoard({
  projects,
  tasks,
  initialFilter,
}: Props) {
  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [panel, setPanel] = useState<PanelMode>({ kind: "closed" });

  useEffect(() => {
    setFilter(readFilterFromUrl());
  }, []);

  const openTasks = useMemo(
    () => tasks.filter((task) => !task.isCompleted),
    [tasks]
  );

  const filteredTasks = useMemo(
    () => filterOpenTasks(tasks, filter),
    [filter, tasks]
  );

  const selectedProject = useMemo(() => {
    if (filter === "all" || filter === "inbox") {
      return null;
    }
    return projects.find((project) => project.id === filter) ?? null;
  }, [filter, projects]);

  const setFilterAndUrl = useCallback((next: FilterKey) => {
    setFilter(next);
    syncFilterToUrl(next);
  }, []);

  const closePanel = useCallback(() => {
    setPanel({ kind: "closed" });
  }, []);

  const openCreateProject = useCallback(() => {
    setPanel({ kind: "project-create" });
  }, []);

  const openEditProject = useCallback((project: Project) => {
    setPanel({ kind: "project-edit", project });
  }, []);

  const openCreateTask = useCallback((projectId: string | null) => {
    setPanel({ kind: "task-create", projectId });
  }, []);

  const onFilterClick = useCallback(
    (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const next = button.dataset.filter;
      if (next) {
        setFilterAndUrl(next);
      }
    },
    [setFilterAndUrl]
  );

  const onProjectRowFilter = useCallback(
    (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const id = button.dataset.projectId;
      if (id) {
        setFilterAndUrl(id);
      }
    },
    [setFilterAndUrl]
  );

  const onAddTaskForProject = useCallback(
    (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const id = button.dataset.projectId;
      if (id) {
        openCreateTask(id);
      }
    },
    [openCreateTask]
  );

  const onEditProjectClick = useCallback(
    (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const id = button.dataset.projectId;
      const project = projects.find((item) => item.id === id);
      if (project) {
        openEditProject(project);
      }
    },
    [openEditProject, projects]
  );

  const onAddTaskHeader = useCallback(() => {
    openCreateTask(selectedProject?.id ?? null);
  }, [openCreateTask, selectedProject]);

  let taskListTitle = "All tasks";
  if (filter === "inbox") {
    taskListTitle = "Inbox";
  } else if (selectedProject) {
    taskListTitle = `#${selectedProject.name}`;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl text-text-primary tracking-tight">
            Projects
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Color-coded categories for Matrix and Today cards.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center rounded-sm bg-primary px-4 font-semibold text-on-primary text-sm"
          onClick={openCreateProject}
          type="button"
        >
          New project
        </button>
      </header>

      <FilterChips
        filter={filter}
        onFilterClick={onFilterClick}
        projects={projects}
      />

      <ProjectList
        onAddTask={onAddTaskForProject}
        onEdit={onEditProjectClick}
        onFilter={onProjectRowFilter}
        openTasks={openTasks}
        projects={projects}
      />

      <TaskListSection
        filteredTasks={filteredTasks}
        onAddTask={onAddTaskHeader}
        projects={projects}
        selectedProject={selectedProject}
        title={taskListTitle}
      />

      {panel.kind === "closed" ? null : (
        <BoardPanel onClose={closePanel} panel={panel} projects={projects} />
      )}
    </div>
  );
}

function FilterChips({
  filter,
  projects,
  onFilterClick,
}: {
  filter: FilterKey;
  onFilterClick: (event: Event) => void;
  projects: Project[];
}) {
  return (
    <fieldset className="flex flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Filter tasks by project</legend>
      <FilterChip
        active={filter === "all"}
        dataFilter="all"
        label="All"
        onClick={onFilterClick}
      />
      <FilterChip
        active={filter === "inbox"}
        dataFilter="inbox"
        label="Inbox"
        onClick={onFilterClick}
      />
      {projects.map((project) => (
        <FilterChip
          active={filter === project.id}
          color={project.color}
          dataFilter={project.id}
          key={project.id}
          label={`#${project.name}`}
          onClick={onFilterClick}
        />
      ))}
    </fieldset>
  );
}

function FilterChip({
  active,
  label,
  onClick,
  color,
  dataFilter,
}: {
  active: boolean;
  color?: string;
  dataFilter: string;
  label: string;
  onClick: (event: Event) => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 font-medium text-sm ${
        active
          ? "border-primary bg-primary text-on-primary"
          : "border-border-contrast bg-surface text-text-secondary hover:bg-surface-elevated"
      }`}
      data-filter={dataFilter}
      onClick={onClick}
      type="button"
    >
      {color ? (
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full"
          style={{ background: color }}
        />
      ) : null}
      {label}
    </button>
  );
}

function ProjectList({
  projects,
  openTasks,
  onFilter,
  onAddTask,
  onEdit,
}: {
  onAddTask: (event: Event) => void;
  onEdit: (event: Event) => void;
  onFilter: (event: Event) => void;
  openTasks: Task[];
  projects: Project[];
}) {
  if (projects.length === 0) {
    return (
      <p className="rounded-md border border-border-contrast bg-surface p-6 text-sm text-text-secondary">
        No projects yet. Create a project first, then add tasks to it. Tasks can
        still live in Inbox without a project.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {projects.map((project) => {
        const count = openTasks.filter(
          (task) => task.projectId === project.id
        ).length;
        return (
          <li
            className="rounded-md border border-border-contrast bg-surface p-4"
            key={project.id}
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
                data-project-id={project.id}
                onClick={onFilter}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ background: project.color }}
                />
                <span className="truncate font-semibold text-text-primary">
                  #{project.name}
                </span>
                <span className="tabular-metrics ml-auto shrink-0 font-mono text-text-muted text-xs">
                  {count} tasks
                </span>
              </button>
              <button
                aria-label={`Add task to ${project.name}`}
                className="inline-flex min-h-11 items-center rounded-sm border border-border-contrast px-3 text-sm text-text-primary hover:bg-surface-elevated"
                data-project-id={project.id}
                onClick={onAddTask}
                type="button"
              >
                Add task
              </button>
              <button
                aria-label={`Edit ${project.name}`}
                className="inline-flex min-h-11 items-center rounded-sm border border-border-contrast px-3 text-sm text-text-secondary hover:bg-surface-elevated"
                data-project-id={project.id}
                onClick={onEdit}
                type="button"
              >
                Edit
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TaskListSection({
  title,
  filteredTasks,
  projects,
  selectedProject,
  onAddTask,
}: {
  filteredTasks: Task[];
  onAddTask: () => void;
  projects: Project[];
  selectedProject: Project | null;
  title: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-lg text-text-primary">{title}</h2>
        <button
          className="inline-flex min-h-11 items-center rounded-sm border border-border-contrast px-3 text-sm text-text-primary hover:bg-surface-elevated"
          onClick={onAddTask}
          type="button"
        >
          {selectedProject ? `Add task to ${selectedProject.name}` : "Add task"}
        </button>
      </div>

      {filteredTasks.length === 0 ? (
        <p className="rounded-md border border-border-contrast bg-surface p-6 text-sm text-text-secondary">
          No tasks in this view.
        </p>
      ) : (
        <ul className="space-y-2">
          {filteredTasks.map((task) => (
            <TaskRow key={task.id} projects={projects} task={task} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TaskRow({ task, projects }: { projects: Project[]; task: Task }) {
  const project = projects.find((item) => item.id === task.projectId);
  const quadrant = getQuadrant(task.isUrgent, task.isImportant);
  const meta = QUADRANT_META[quadrant];

  return (
    <li>
      <button
        className="task-open flex min-h-11 w-full items-center gap-3 rounded-md border border-border-contrast bg-surface px-4 py-3 text-left hover:bg-surface-elevated"
        data-task-id={task.id}
        type="button"
      >
        <span className="min-w-0 flex-1 truncate font-medium text-sm text-text-primary">
          {task.title}
        </span>
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
    </li>
  );
}

function BoardPanel({
  panel,
  projects,
  onClose,
}: {
  onClose: () => void;
  panel: Exclude<PanelMode, { kind: "closed" }>;
  projects: Project[];
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(
    panel.kind === "project-edit" ? panel.project.name : ""
  );
  const [projectColor, setProjectColor] = useState(
    panel.kind === "project-edit" ? panel.project.color : COLOR_PRESETS[0]
  );
  const [taskTitle, setTaskTitle] = useState("");
  const [taskProjectId, setTaskProjectId] = useState<string | null>(
    panel.kind === "task-create" ? panel.projectId : null
  );

  const lockedProject =
    panel.kind === "task-create" && panel.projectId
      ? (projects.find((project) => project.id === panel.projectId) ?? null)
      : null;

  let panelTitle = "Add task";
  if (panel.kind === "project-create") {
    panelTitle = "New project";
  } else if (panel.kind === "project-edit") {
    panelTitle = "Edit project";
  }

  const onProjectNameInput = useCallback((event: Event) => {
    const { value } = event.currentTarget as HTMLInputElement;
    setProjectName(value);
  }, []);

  const onTaskTitleInput = useCallback((event: Event) => {
    const { value } = event.currentTarget as HTMLInputElement;
    setTaskTitle(value);
  }, []);

  const onTaskProjectChange = useCallback((event: Event) => {
    const { value } = event.currentTarget as HTMLSelectElement;
    setTaskProjectId(value === "" ? null : value);
  }, []);

  const onColorClick = useCallback((event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const { color } = button.dataset;
    if (color) {
      setProjectColor(color);
    }
  }, []);

  const onSaveProject = useCallback(async () => {
    const name = projectName.trim();
    if (!name || isBusy) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      if (panel.kind === "project-create") {
        await orpc.projects.create({ color: projectColor, name });
      } else if (panel.kind === "project-edit") {
        await orpc.projects.update({
          color: projectColor,
          id: panel.project.id,
          name,
        });
      }
      onClose();
      location.reload();
    } catch {
      setError("Could not save project. Try again.");
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, onClose, panel, projectColor, projectName]);

  const onDeleteProject = useCallback(async () => {
    if (panel.kind !== "project-edit" || isBusy) {
      return;
    }
    if (confirmDeleteId !== panel.project.id) {
      setConfirmDeleteId(panel.project.id);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await orpc.projects.delete({ id: panel.project.id });
      onClose();
      location.reload();
    } catch {
      setError("Could not delete project. Try again.");
    } finally {
      setIsBusy(false);
    }
  }, [confirmDeleteId, isBusy, onClose, panel]);

  const onCreateTask = useCallback(async () => {
    const title = taskTitle.trim();
    if (!title || isBusy) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await orpc.tasks.create({
        projectId: taskProjectId,
        title,
      });
      onClose();
      location.reload();
    } catch {
      setError("Could not create task. Try again.");
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, onClose, taskProjectId, taskTitle]);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      role="dialog"
    >
      <button
        aria-label="Close panel"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative z-10 flex max-h-[92svh] w-full max-w-lg flex-col overflow-y-auto rounded-t-md border border-border-contrast bg-surface sm:rounded-md">
        <header className="sticky top-0 z-10 flex items-center justify-between border-border-contrast border-b bg-surface px-4 py-3">
          <h2 className="font-semibold text-sm text-text-secondary">
            {panelTitle}
          </h2>
          <button
            aria-label="Close"
            className="flex size-11 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </header>

        <div className="space-y-4 px-4 py-5">
          {panel.kind === "project-create" || panel.kind === "project-edit" ? (
            <ProjectFormFields
              confirmDelete={
                panel.kind === "project-edit" &&
                confirmDeleteId === panel.project.id
              }
              error={error}
              isBusy={isBusy}
              onColorClick={onColorClick}
              onDelete={
                panel.kind === "project-edit" ? onDeleteProject : undefined
              }
              onNameInput={onProjectNameInput}
              onSave={onSaveProject}
              projectColor={projectColor}
              projectName={projectName}
              showDelete={panel.kind === "project-edit"}
            />
          ) : null}

          {panel.kind === "task-create" ? (
            <TaskCreateFields
              error={error}
              isBusy={isBusy}
              lockedProject={lockedProject}
              onCreate={onCreateTask}
              onProjectChange={onTaskProjectChange}
              onTitleInput={onTaskTitleInput}
              projects={projects}
              taskProjectId={taskProjectId}
              taskTitle={taskTitle}
            />
          ) : null}

          <button
            className="flex min-h-11 w-full items-center justify-center rounded-sm text-sm text-text-secondary hover:bg-surface-elevated"
            disabled={isBusy}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectFormFields({
  projectName,
  projectColor,
  error,
  isBusy,
  showDelete,
  confirmDelete,
  onNameInput,
  onColorClick,
  onSave,
  onDelete,
}: {
  confirmDelete: boolean;
  error: string | null;
  isBusy: boolean;
  onColorClick: (event: Event) => void;
  onDelete?: () => void;
  onNameInput: (event: Event) => void;
  onSave: () => void;
  projectColor: string;
  projectName: string;
  showDelete: boolean;
}) {
  return (
    <>
      <label className="block space-y-1.5">
        <span className="font-medium text-sm text-text-secondary">Name</span>
        <input
          className="min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 text-text-primary focus:border-primary focus:outline-none"
          onInput={onNameInput}
          placeholder="Project name…"
          type="text"
          value={projectName}
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="font-medium text-sm text-text-secondary">
          Color
        </legend>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((color) => {
            const selected = projectColor === color;
            return (
              <button
                aria-label={`Color ${color}`}
                aria-pressed={selected}
                className={`size-11 rounded-full border-2 ${
                  selected ? "border-text-primary" : "border-transparent"
                }`}
                data-color={color}
                key={color}
                onClick={onColorClick}
                style={{ background: color }}
                type="button"
              />
            );
          })}
        </div>
      </fieldset>
      {error ? (
        <p className="text-capacity-over text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="flex min-h-11 w-full items-center justify-center rounded-sm bg-primary font-semibold text-on-primary text-sm disabled:opacity-60"
        disabled={isBusy || projectName.trim().length === 0}
        onClick={onSave}
        type="button"
      >
        {isBusy ? "Saving…" : "Save project"}
      </button>
      {showDelete && onDelete ? (
        <>
          <button
            className="flex min-h-11 w-full items-center justify-center rounded-sm text-capacity-over text-sm hover:bg-capacity-over/10 disabled:opacity-60"
            disabled={isBusy}
            onClick={onDelete}
            type="button"
          >
            {confirmDelete ? "Confirm delete" : "Delete project"}
          </button>
          {confirmDelete ? (
            <p className="text-center text-sm text-text-secondary">
              Tasks in this project become unassigned (Inbox). Tap Confirm
              delete again.
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function TaskCreateFields({
  lockedProject,
  projects,
  taskProjectId,
  taskTitle,
  error,
  isBusy,
  onProjectChange,
  onTitleInput,
  onCreate,
}: {
  error: string | null;
  isBusy: boolean;
  lockedProject: Project | null;
  onCreate: () => void;
  onProjectChange: (event: Event) => void;
  onTitleInput: (event: Event) => void;
  projects: Project[];
  taskProjectId: string | null;
  taskTitle: string;
}) {
  return (
    <>
      {lockedProject ? (
        <p
          className="font-mono text-xs uppercase tracking-wide"
          style={{ color: lockedProject.color }}
        >
          #{lockedProject.name}
        </p>
      ) : (
        <label className="block space-y-1.5">
          <span className="font-medium text-sm text-text-secondary">
            Project
          </span>
          <select
            className="min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 text-text-primary focus:border-primary focus:outline-none"
            onChange={onProjectChange}
            value={taskProjectId ?? ""}
          >
            <option value="">Inbox (no project)</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                #{project.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block space-y-1.5">
        <span className="font-medium text-sm text-text-secondary">Title</span>
        <input
          className="min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 text-text-primary focus:border-primary focus:outline-none"
          onInput={onTitleInput}
          placeholder="Task title…"
          type="text"
          value={taskTitle}
        />
      </label>
      {error ? (
        <p className="text-capacity-over text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="flex min-h-11 w-full items-center justify-center rounded-sm bg-primary font-semibold text-on-primary text-sm disabled:opacity-60"
        disabled={isBusy || taskTitle.trim().length === 0}
        onClick={onCreate}
        type="button"
      >
        {isBusy ? "Adding…" : "Add task"}
      </button>
    </>
  );
}
