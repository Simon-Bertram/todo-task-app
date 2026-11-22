import { useCallback, useEffect, useState } from "preact/hooks";
import {
  capacityTone,
  formatMinutes,
  getQuadrant,
  QUADRANT_META,
} from "../../lib/quadrant";
import type {
  Project,
  Task,
  TaskProgressControl,
} from "../../lib/task-helpers";
import { isLongTask, openSubtaskCount } from "../../lib/task-helpers";
import type { TaskDetailFormApi } from "../../lib/use-task-detail-form";
import {
  TASK_DETAIL_ETC_PRESETS,
  TASK_DETAIL_RECURRENCE,
} from "../../lib/use-task-detail-form";
import DayPicker from "./day-picker";
import ProjectNotesDisclosure from "./project-notes-disclosure";
import RatingRow from "./rating-row";
import TaskProgress from "./task-progress";
import TaskSubtasksEditor from "./task-subtasks-editor";

/**
 * Presentational sheet body for task editing.
 *
 * State and mutations live outside this file:
 * - form values/setters → `useTaskDetailForm`
 * - save / delete / today / complete → `useTaskDetailMutations` via `TaskDetailSheet`
 *
 * Interactive sections reused elsewhere are sibling islands (`DayPicker`,
 * `ProjectNotesDisclosure`, `RatingRow`, `TaskProgress`).
 */
export interface TaskDetailFormProps {
  baseTask: Task;
  budgetMinutes: number;
  busy: boolean;
  confirmDelete: boolean;
  error: string | null;
  form: TaskDetailFormApi;
  isDeleting: boolean;
  isSaving: boolean;
  onClose: () => void;
  onDelete: () => void;
  onProgressPersisted: (next: number) => void;
  onProjectNotesSaved: (notes: string | null) => void;
  onSave: () => void;
  onSubtaskCountsChange: (counts: {
    subtaskCompletedCount: number;
    subtaskCount: number;
  }) => void;
  plannedMinutes: number;
  /** Set by the sheet so deep-links can scroll/focus the progress block. */
  progressSectionRef: { current: HTMLElement | null };
  projects: Project[];
  taskProgressControl: TaskProgressControl;
  toggleCompleted: () => void;
  toggleToday: () => void;
}

export function TaskDetailForm({
  baseTask,
  budgetMinutes,
  busy,
  confirmDelete,
  error,
  form,
  isDeleting,
  isSaving,
  onClose,
  onDelete,
  onProgressPersisted,
  onProjectNotesSaved,
  onSave,
  onSubtaskCountsChange,
  plannedMinutes,
  progressSectionRef,
  projects,
  taskProgressControl,
  toggleCompleted,
  toggleToday,
}: TaskDetailFormProps) {
  const { values } = form;
  const quadrant = getQuadrant(values.isUrgent, values.isImportant);
  const meta = QUADRANT_META[quadrant];
  const selectedProject = projects.find((item) => item.id === values.projectId);
  const [isRecurrenceOpen, setIsRecurrenceOpen] = useState(false);
  // If the task is not already on Today, treat its ETC as additional load so
  // we can warn before the user schedules it over budget.
  const projectedPlanned = values.isToday
    ? plannedMinutes
    : plannedMinutes + values.estimatedMinutes;
  const remaining = Math.max(budgetMinutes - plannedMinutes, 0);
  const overBy = projectedPlanned - budgetMinutes;
  const showOverWarning = !values.isToday && overBy > 0;
  const tone = capacityTone(projectedPlanned, budgetMinutes);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when navigating to another task
  useEffect(() => {
    setIsRecurrenceOpen(false);
  }, [baseTask.id]);

  const onRecurrenceToggle = useCallback(() => {
    setIsRecurrenceOpen((open) => !open);
  }, []);

  const recurrenceLabel =
    TASK_DETAIL_RECURRENCE.find((rule) => rule.value === values.recurrence)
      ?.label ?? "None";
  const recurrenceToggleLabel =
    values.recurrence === null
      ? "Recurrence"
      : `Recurrence · ${recurrenceLabel}`;

  // Two-tap delete: first tap arms confirm; second tap (confirmDelete) deletes.
  let deleteLabel = "Delete task";
  if (isDeleting) {
    deleteLabel = "Deleting…";
  } else if (confirmDelete) {
    deleteLabel = "Confirm delete";
  }

  return (
    <div
      aria-labelledby="task-detail-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      role="dialog"
    >
      {/* Backdrop dismiss */}
      <button
        aria-label="Close task detail"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      {/* Bottom sheet on mobile; centered modal from sm up */}
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
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </header>

        <div className="space-y-6 px-4 py-5">
          {/* Identity: title, project, notes */}
          <label className="block space-y-1.5">
            <span className="font-medium text-sm text-text-secondary">
              Title
            </span>
            <input
              className="min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 font-semibold text-lg text-text-primary focus:border-primary focus:outline-none"
              data-testid="task-detail-title"
              onInput={form.onTitleInput}
              type="text"
              value={values.title}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="font-medium text-sm text-text-secondary">
              Project
            </span>
            <select
              className="min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 text-text-primary focus:border-primary focus:outline-none"
              onChange={form.onProjectChange}
              value={values.projectId ?? ""}
            >
              <option value="">Inbox (no project)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  #{project.name}
                </option>
              ))}
            </select>
            {selectedProject ? (
              <span
                className="inline-block font-mono text-xs uppercase tracking-wide"
                style={{ color: selectedProject.color }}
              >
                #{selectedProject.name}
              </span>
            ) : null}
          </label>

          {selectedProject ? (
            <ProjectNotesDisclosure
              key={selectedProject.id}
              notes={selectedProject.notes}
              onSaved={onProjectNotesSaved}
              projectId={selectedProject.id}
            />
          ) : null}

          <label className="block space-y-1.5">
            <span className="font-medium text-sm text-text-secondary">
              Notes
            </span>
            <textarea
              className="min-h-24 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              onInput={form.onNotesInput}
              placeholder="Optional notes (markdown supported later)"
              value={values.notes}
            />
          </label>

          <TaskSubtasksEditor
            key={baseTask.id}
            onCountsChange={onSubtaskCountsChange}
            taskId={baseTask.id}
          />

          <section className="space-y-2">
            <h4 className="font-medium text-sm text-text-secondary">
              Due date
            </h4>
            <DayPicker onChange={form.setDueDate} value={values.dueDate} />
          </section>

          {/* Eisenhower: quadrant is derived from urgency/importance (≥ 2 = high). */}
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
              onChange={form.setIsUrgent}
              value={values.isUrgent}
            />
            <RatingRow
              label="Importance"
              onChange={form.setIsImportant}
              value={values.isImportant}
            />
            <p className="rounded-sm bg-canvas/60 px-2 py-1.5 font-mono text-text-muted text-xs">
              Rule: Urgency ≥ 2 AND Importance ≥ 2 = Q1
            </p>
          </section>

          {/* Capacity: ETC presets + warn when scheduling would overrun the day budget */}
          <section className="space-y-2">
            <h4 className="font-medium text-sm text-text-secondary">
              Estimated time
            </h4>
            <div className="flex flex-wrap gap-2">
              {TASK_DETAIL_ETC_PRESETS.map((minutes) => {
                const selected = values.estimatedMinutes === minutes;
                return (
                  <button
                    className={`min-h-11 rounded-full border px-3 font-mono text-sm ${
                      selected
                        ? "border-primary bg-primary text-on-primary"
                        : "border-border-contrast bg-surface-subtle text-text-secondary"
                    }`}
                    data-etc={minutes}
                    key={minutes}
                    onClick={form.onEtcClick}
                    type="button"
                  >
                    {formatMinutes(minutes)}
                  </button>
                );
              })}
            </div>
            {showOverWarning ? (
              <p className="rounded-sm border border-capacity-over/40 bg-capacity-over/10 px-3 py-2 text-capacity-over text-sm">
                Adding {formatMinutes(values.estimatedMinutes)} exceeds the
                remaining {remaining}mins budget by {overBy}mins ({tone} load).
              </p>
            ) : null}
          </section>

          {/* Progress UI only for long tasks (see isLongTask). */}
          {isLongTask(values.estimatedMinutes) ? (
            <section className="space-y-2" ref={progressSectionRef}>
              <TaskProgress
                control={taskProgressControl}
                interactive
                onPersisted={onProgressPersisted}
                progressPercent={values.progressPercent}
                size="sheet"
                taskId={baseTask.id}
              />
            </section>
          ) : null}

          <div className="space-y-2">
            <button
              aria-expanded={isRecurrenceOpen}
              className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border border-border-contrast px-3 text-left text-sm text-text-secondary hover:bg-surface-elevated"
              onClick={onRecurrenceToggle}
              type="button"
            >
              <span>{recurrenceToggleLabel}</span>
              <span aria-hidden="true" className="text-text-muted">
                {isRecurrenceOpen ? "▾" : "▸"}
              </span>
            </button>
            {isRecurrenceOpen ? (
              <div className="flex flex-wrap gap-1 rounded-full border border-border-subtle bg-surface-subtle p-1">
                {TASK_DETAIL_RECURRENCE.map((rule) => {
                  const selected = values.recurrence === rule.value;
                  return (
                    <button
                      className={`min-h-10 rounded-full px-3 font-medium text-sm ${
                        selected
                          ? "bg-surface-elevated text-text-primary"
                          : "text-text-secondary"
                      }`}
                      data-recurrence={rule.value ?? "null"}
                      key={rule.label}
                      onClick={form.onRecurrenceClick}
                      type="button"
                    >
                      {rule.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="text-capacity-over text-sm" role="alert">
              {error}
            </p>
          ) : null}

          {/* Primary actions — handlers come from TaskDetailSheet mutations. */}
          <div className="space-y-2 pb-2">
            <button
              className="flex min-h-11 w-full items-center justify-center rounded-sm bg-primary font-semibold text-on-primary text-sm disabled:opacity-60"
              data-testid="task-detail-save"
              disabled={busy}
              onClick={onSave}
              type="button"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
            <button
              className="flex min-h-11 w-full items-center justify-center rounded-sm border border-border-contrast text-sm text-text-primary disabled:opacity-60"
              data-testid={
                values.isToday
                  ? "task-detail-remove-today"
                  : "task-detail-add-today"
              }
              disabled={busy}
              onClick={toggleToday}
              type="button"
            >
              {values.isToday
                ? "Remove from Today's board"
                : "Schedule to Today's board"}
            </button>
            <CompleteTaskControl
              busy={busy}
              isCompleted={values.isCompleted}
              onToggle={toggleCompleted}
              openCount={openSubtaskCount(baseTask)}
            />
            <button
              className="flex min-h-11 w-full items-center justify-center rounded-sm text-capacity-over text-sm hover:bg-capacity-over/10 disabled:opacity-60"
              disabled={busy}
              onClick={onDelete}
              type="button"
            >
              {deleteLabel}
            </button>
            {confirmDelete ? (
              <p className="text-center text-sm text-text-secondary">
                This cannot be undone. Tap Confirm delete again.
              </p>
            ) : null}
            <button
              className="flex min-h-11 w-full items-center justify-center rounded-sm text-sm text-text-secondary hover:bg-surface-elevated"
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompleteTaskControl({
  busy,
  isCompleted,
  openCount,
  onToggle,
}: {
  busy: boolean;
  isCompleted: boolean;
  onToggle: () => void;
  openCount: number;
}) {
  const blocked = !isCompleted && openCount > 0;
  const buttonClass = isCompleted
    ? "flex min-h-11 w-full items-center justify-center rounded-sm border border-border-contrast text-sm text-text-primary disabled:opacity-60"
    : "flex min-h-11 w-full items-center justify-center rounded-sm bg-capacity-ok font-semibold text-on-primary text-sm disabled:opacity-60";

  return (
    <>
      <button
        className={buttonClass}
        data-testid="task-detail-completed"
        disabled={busy || blocked}
        onClick={onToggle}
        type="button"
      >
        {isCompleted ? "Reopen task" : "Mark as Completed"}
      </button>
      {blocked ? (
        <p className="text-center text-sm text-text-secondary">
          Finish or remove all subtasks before completing this task ({openCount}{" "}
          open).
        </p>
      ) : null}
    </>
  );
}
