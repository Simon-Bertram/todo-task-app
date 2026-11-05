import { useCallback, useState } from "preact/hooks";
import { orpc } from "../../lib/orpc";
import type { Project } from "../../lib/task-helpers";
import ProjectNotesDisclosure from "./project-notes-disclosure";

export type PanelMode =
  | { kind: "closed" }
  | { kind: "project-create" }
  | { kind: "project-edit"; project: Project }
  | { kind: "task-create"; projectId: string | null };

export const COLOR_PRESETS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#64748b",
] as const;

export function BoardPanel({
  panel,
  projects,
  onClose,
  onProjectDeleted,
  onProjectSaved,
  onTaskCreated,
}: {
  onClose: () => void;
  onProjectDeleted: (projectId: string) => void;
  onProjectSaved: (project: Project) => void;
  onTaskCreated: () => void;
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
  const [projectNotes, setProjectNotes] = useState(
    panel.kind === "project-edit" ? (panel.project.notes ?? "") : ""
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

  const onProjectNotesChange = useCallback((value: string) => {
    setProjectNotes(value);
  }, []);

  const onSaveProject = useCallback(async () => {
    const name = projectName.trim();
    if (!name || isBusy) {
      return;
    }
    const notes = projectNotes.trim() ? projectNotes.trim() : null;
    setIsBusy(true);
    setError(null);
    try {
      if (panel.kind === "project-create") {
        const created = await orpc.projects.create({
          color: projectColor,
          name,
          notes,
        });
        onProjectSaved(created);
      } else if (panel.kind === "project-edit") {
        const updated = await orpc.projects.update({
          color: projectColor,
          id: panel.project.id,
          name,
          notes,
        });
        onProjectSaved(updated);
      }
      onClose();
    } catch {
      setError("Could not save project. Try again.");
    } finally {
      setIsBusy(false);
    }
  }, [
    isBusy,
    onClose,
    onProjectSaved,
    panel,
    projectColor,
    projectName,
    projectNotes,
  ]);

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
      onProjectDeleted(panel.project.id);
      onClose();
    } catch {
      setError("Could not delete project. Try again.");
    } finally {
      setIsBusy(false);
    }
  }, [confirmDeleteId, isBusy, onClose, onProjectDeleted, panel]);

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
      onTaskCreated();
      onClose();
    } catch {
      setError("Could not create task. Try again.");
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, onClose, onTaskCreated, taskProjectId, taskTitle]);

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
              onNotesChange={onProjectNotesChange}
              onSave={onSaveProject}
              projectColor={projectColor}
              projectName={projectName}
              projectNotes={projectNotes}
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
  projectNotes,
  error,
  isBusy,
  showDelete,
  confirmDelete,
  onNameInput,
  onNotesChange,
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
  onNotesChange: (value: string) => void;
  onSave: () => void;
  projectColor: string;
  projectName: string;
  projectNotes: string;
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
      <ProjectNotesDisclosure
        mode="draft"
        onChange={onNotesChange}
        value={projectNotes}
      />
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
