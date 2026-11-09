import type { JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { orpc } from "../../lib/orpc";
import { showToast } from "../../lib/toast";

export interface QuickAddProject {
  id: string;
  name: string;
}

interface Props {
  projects?: QuickAddProject[];
}

const TRIGGER_IDS = [
  "quick-add-fab",
  "quick-add-header",
  "quick-add-sidenav",
] as const;

export default function QuickAddDialog({ projects = [] }: Props): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const openQuickAdd = () => {
      setError(null);
      formRef.current?.reset();
      dialogRef.current?.showModal();
      queueMicrotask(() => {
        titleRef.current?.focus();
      });
    };

    const triggers = TRIGGER_IDS.map((id) => document.getElementById(id));
    for (const trigger of triggers) {
      trigger?.addEventListener("click", openQuickAdd);
    }
    document.addEventListener("plansage:quick-add", openQuickAdd);

    return () => {
      for (const trigger of triggers) {
        trigger?.removeEventListener("click", openQuickAdd);
      }
      document.removeEventListener("plansage:quick-add", openQuickAdd);
    };
  }, []);

  const handleCancel = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const createTask = useCallback(
    async (form: HTMLFormElement, isToday: boolean) => {
      const data = new FormData(form);
      const title = String(data.get("title") ?? "").trim();
      if (!title) {
        return;
      }

      setBusy(true);
      setError(null);

      try {
        const rawProjectId = String(data.get("projectId") ?? "").trim();
        await orpc.tasks.create({
          title,
          ...(rawProjectId.length > 0 ? { projectId: rawProjectId } : {}),
          ...(isToday ? { isToday: true } : {}),
        });
        dialogRef.current?.close();
        showToast("Task added", "success");
        location.reload();
      } catch {
        setError("Could not create task. Try again.");
        showToast("Could not create task. Try again.", "error");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const handleSubmit = useCallback(
    async (event: Event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      await createTask(form, false);
    },
    [createTask]
  );

  const handleAddToday = useCallback(async () => {
    const form = formRef.current;
    if (!form.reportValidity()) {
      return;
    }
    await createTask(form, true);
  }, [createTask]);

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
