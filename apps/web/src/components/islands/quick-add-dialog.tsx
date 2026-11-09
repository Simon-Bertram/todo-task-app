/**
 * Quick Add markup island. Open wiring + create mutation live in
 * `useQuickAddDialog`; this file owns the dialog/form UI and project select.
 */
import type { JSX } from "preact";

import { useQuickAddDialog } from "../../lib/use-quick-add-dialog";

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
    formRef,
    handleAddToday,
    handleCancel,
    handleSubmit,
    titleRef,
  } = useQuickAddDialog();

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
          Capture a task title. You can refine priorities in the detail sheet.
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
