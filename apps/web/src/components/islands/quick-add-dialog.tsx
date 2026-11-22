/**
 * Quick Add markup island. Open wiring + create mutation live in
 * `useQuickAddDialog`; this file owns the dialog/form UI and project select.
 */
import type { JSX } from "preact";

import { formatMinutes } from "../../lib/quadrant";
import { useQuickAddDialog } from "../../lib/use-quick-add-dialog";
import { TASK_DETAIL_ETC_PRESETS } from "../../lib/use-task-detail-form";
import RatingRow from "./rating-row";

export interface QuickAddProject {
  id: string;
  name: string;
}

interface Props {
  projects?: QuickAddProject[];
}

export default function QuickAddDialog({ projects = [] }: Props): JSX.Element {
  const {
    busy,
    dialogRef,
    error,
    estimatedMinutes,
    formRef,
    handleAddToday,
    handleCancel,
    handleSubmit,
    isDurationOpen,
    isImportant,
    isPriorityOpen,
    isUrgent,
    onDurationToggle,
    onEtcClick,
    onPriorityToggle,
    setIsImportant,
    setIsUrgent,
    titleRef,
  } = useQuickAddDialog();

  const durationToggleLabel = `Duration · ${formatMinutes(estimatedMinutes)}`;
  const priorityToggleLabel = `Priority · U${isUrgent} · I${isImportant}`;

  return (
    <dialog
      className="glass-panel m-auto w-[min(100%,24rem)] rounded-md p-5 text-text-primary backdrop:bg-black/60"
      id="quick-add-dialog"
      ref={dialogRef}
    >
      <form
        className="space-y-4"
        id="quick-add-form"
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <h2 className="font-semibold text-lg">Quick add</h2>
        <p className="text-sm text-text-secondary">
          Capture a title. Optionally set duration and priority below.
        </p>
        <input
          className="min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
          data-testid="quick-add-title"
          name="title"
          placeholder="Task title…"
          ref={titleRef}
          required
          type="text"
        />
        {projects.length > 0 ? (
          <label className="block space-y-1.5">
            <span className="font-medium text-sm text-text-secondary">
              Project
            </span>
            <select
              className="min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 text-text-primary focus:border-primary focus:outline-none"
              name="projectId"
            >
              <option value="">Inbox (no project)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  #{project.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="space-y-2">
          <button
            aria-expanded={isDurationOpen}
            className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border border-border-contrast px-3 text-left text-sm text-text-secondary hover:bg-surface-elevated"
            onClick={onDurationToggle}
            type="button"
          >
            <span>{durationToggleLabel}</span>
            <span aria-hidden="true" className="text-text-muted">
              {isDurationOpen ? "▾" : "▸"}
            </span>
          </button>
          {isDurationOpen ? (
            <div className="flex flex-wrap gap-2">
              {TASK_DETAIL_ETC_PRESETS.map((minutes) => {
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
          ) : null}
        </div>

        <div className="space-y-2">
          <button
            aria-expanded={isPriorityOpen}
            className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border border-border-contrast px-3 text-left text-sm text-text-secondary hover:bg-surface-elevated"
            onClick={onPriorityToggle}
            type="button"
          >
            <span>{priorityToggleLabel}</span>
            <span aria-hidden="true" className="text-text-muted">
              {isPriorityOpen ? "▾" : "▸"}
            </span>
          </button>
          {isPriorityOpen ? (
            <div className="space-y-3 rounded-sm border border-border-contrast bg-surface-subtle p-3">
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
            </div>
          ) : null}
        </div>

        <p
          className={
            error
              ? "text-capacity-over text-sm"
              : "hidden text-capacity-over text-sm"
          }
          id="quick-add-error"
          role="alert"
        >
          {error}
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="min-h-11 rounded-sm border border-border-contrast px-4 text-sm text-text-primary"
            id="quick-add-cancel"
            onClick={handleCancel}
            type="button"
          >
            Cancel
          </button>
          {/* type="button" so this does not also fire the form onSubmit handler. */}
          <button
            className="min-h-11 rounded-sm border border-border-contrast px-4 text-sm text-text-primary disabled:opacity-50"
            data-testid="quick-add-submit-today"
            disabled={busy}
            onClick={handleAddToday}
            type="button"
          >
            Add (Today)
          </button>
          <button
            className="min-h-11 rounded-sm bg-primary px-4 font-semibold text-on-primary text-sm disabled:opacity-50"
            data-testid="quick-add-submit"
            disabled={busy}
            type="submit"
          >
            Add
          </button>
        </div>
      </form>
    </dialog>
  );
}
