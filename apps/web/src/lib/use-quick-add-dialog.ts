import type { RefObject } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { orpc } from "./orpc";
import { showToast } from "./toast";

/**
 * Shell buttons in Astro (FAB / header / sidenav) open via these DOM ids.
 * Other islands (e.g. tasks board) open via the `plansage:quick-add` custom event.
 */
const TRIGGER_IDS = [
  "quick-add-fab",
  "quick-add-header",
  "quick-add-sidenav",
] as const;

export interface UseQuickAddDialogResult {
  busy: boolean;
  dialogRef: RefObject<HTMLDialogElement | null>;
  error: string | null;
  formRef: RefObject<HTMLFormElement | null>;
  handleAddToday: () => Promise<void>;
  handleCancel: () => void;
  handleSubmit: (event: Event) => Promise<void>;
  titleRef: RefObject<HTMLInputElement | null>;
}

/**
 * Controller for the Quick Add native `<dialog>`: open wiring, create mutation,
 * and the shared submit path used by both "Add" and "Add (Today)".
 */
export function useQuickAddDialog(): UseQuickAddDialogResult {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const openQuickAdd = () => {
      setError(null);
      formRef.current?.reset();
      // Native dialog: showModal() then focus title after the modal paints.
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

  // Shared by form onSubmit (isToday=false) and the Today button (isToday=true).
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
        // V1 sync model: reload so SSR boards revalidate instead of local state.
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

  return {
    busy,
    dialogRef,
    error,
    formRef,
    handleAddToday,
    handleCancel,
    handleSubmit,
    titleRef,
  };
}
