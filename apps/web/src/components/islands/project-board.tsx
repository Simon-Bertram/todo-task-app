import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type {
  Project,
  Task,
  TaskProgressControl,
} from "../../lib/task-helpers";
import { showToast } from "../../lib/toast";
import { BoardPanel, type PanelMode } from "./project-board-panel";
import ProjectNotesDisclosure from "./project-notes-disclosure";
import { TaskListRow } from "./task-list-row";

interface Props {
  initialFilter: string;
  projects: Project[];
  taskProgressControl?: TaskProgressControl;
  tasks: Task[];
}

type FilterKey = "all" | "inbox" | string;

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
  projects: initialProjects,
  tasks: initialTasks,
  initialFilter,
  taskProgressControl = "pie",
}: Props) {
  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [panel, setPanel] = useState<PanelMode>({ kind: "closed" });
  const [projects, setProjects] = useState(initialProjects);
  const [tasks, setTasks] = useState(initialTasks);

  useEffect(() => {
    setFilter(readFilterFromUrl());
  }, []);

  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

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

  const onProjectNotesSaved = useCallback(
    (projectId: string, notes: string | null) => {
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId ? { ...project, notes } : project
        )
      );
      showToast("Project notes saved", "success");
    },
    []
  );

  const onProjectSaved = useCallback((project: Project) => {
    setProjects((current) => {
      const exists = current.some((item) => item.id === project.id);
      if (exists) {
        return current.map((item) =>
          item.id === project.id ? { ...item, ...project } : item
        );
      }
      return [...current, project];
    });
    showToast("Project saved", "success");
  }, []);

  const onProjectDeleted = useCallback(
    (projectId: string) => {
      setProjects((current) =>
        current.filter((project) => project.id !== projectId)
      );
      setTasks((current) =>
        current.map((task) =>
          task.projectId === projectId ? { ...task, projectId: null } : task
        )
      );
      if (filter === projectId) {
        setFilterAndUrl("all");
      }
      showToast("Project deleted", "success");
    },
    [filter, setFilterAndUrl]
  );

  const onTaskCreated = useCallback(() => {
    showToast("Task added", "success");
    location.reload();
  }, []);

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
        onNotesSaved={onProjectNotesSaved}
        openTasks={openTasks}
        projects={projects}
      />

      <TaskListSection
        control={taskProgressControl}
        filteredTasks={filteredTasks}
        onAddTask={onAddTaskHeader}
        projects={projects}
        selectedProject={selectedProject}
        title={taskListTitle}
      />

      {panel.kind === "closed" ? null : (
        <BoardPanel
          onClose={closePanel}
          onProjectDeleted={onProjectDeleted}
          onProjectSaved={onProjectSaved}
          onTaskCreated={onTaskCreated}
          panel={panel}
          projects={projects}
        />
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
  onNotesSaved,
}: {
  onAddTask: (event: Event) => void;
  onEdit: (event: Event) => void;
  onFilter: (event: Event) => void;
  onNotesSaved: (projectId: string, notes: string | null) => void;
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
      {projects.map((project) => (
        <ProjectListItem
          key={project.id}
          onAddTask={onAddTask}
          onEdit={onEdit}
          onFilter={onFilter}
          onNotesSaved={onNotesSaved}
          openTaskCount={
            openTasks.filter((task) => task.projectId === project.id).length
          }
          project={project}
        />
      ))}
    </ul>
  );
}

function ProjectListItem({
  project,
  openTaskCount,
  onFilter,
  onAddTask,
  onEdit,
  onNotesSaved,
}: {
  onAddTask: (event: Event) => void;
  onEdit: (event: Event) => void;
  onFilter: (event: Event) => void;
  onNotesSaved: (projectId: string, notes: string | null) => void;
  openTaskCount: number;
  project: Project;
}) {
  const handleNotesSaved = useCallback(
    (notes: string | null) => {
      onNotesSaved(project.id, notes);
    },
    [onNotesSaved, project.id]
  );

  return (
    <li className="rounded-md border border-border-contrast bg-surface p-4">
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
            {openTaskCount} tasks
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
      <div className="mt-3">
        <ProjectNotesDisclosure
          key={project.id}
          notes={project.notes}
          onSaved={handleNotesSaved}
          projectId={project.id}
        />
      </div>
    </li>
  );
}

function TaskListSection({
  title,
  filteredTasks,
  projects,
  selectedProject,
  onAddTask,
  control,
}: {
  control: TaskProgressControl;
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
            <TaskListRow
              control={control}
              key={task.id}
              projects={projects}
              showDue={false}
              task={task}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
