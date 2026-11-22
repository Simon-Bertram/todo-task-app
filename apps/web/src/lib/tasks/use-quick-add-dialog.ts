import type { RefObject } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { orpc } from "@/lib/rpc/orpc";
import { showToast } from "@/lib/ui/toast";

/**
 * Shell buttons in Astro (FAB / header / sidenav) open via these DOM ids.
 * Other islands (e.g. tasks board) open via the `plansage:quick-add` custom event.
 */
const TRIGGER_IDS = [
  "quick-add-fab",
  "quick-add-header",
  "quick-add-sidenav",
] as const;

const DEFAULT_ESTIMATED_MINUTES = 30;
const DUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const DUE_TIME_PATTERN = /^\d{2}:\d{2}$/u;

function readOptionalDueFields(form: HTMLFormElement): {
  dueDate?: string;
  dueTime?: string;
} {
  const data = new FormData(form);
  const rawDueDate = String(data.get("dueDate") ?? "").trim();
  const rawDueTime = String(data.get("dueTime") ?? "").trim();
  const dueDate = DUE_DATE_PATTERN.test(rawDueDate) ? rawDueDate : null;
  const dueTime =
    dueDate && DUE_TIME_PATTERN.test(rawDueTime) ? rawDueTime : null;
  return {
    ...(dueDate ? { dueDate } : {}),
    ...(dueTime ? { dueTime } : {}),
  };
}

export interface UseQuickAddDialogResult {
  busy: boolean;
  dialogRef: RefObject<HTMLDialogElement | null>;
  error: string | null;
  estimatedMinutes: number;
  formRef: RefObject<HTMLFormElement | null>;
  handleAddToday: () => Promise<void>;
  handleCancel: () => void;
  handleSubmit: (event: Event) => Promise<void>;
  isDurationOpen: boolean;
  isImportant: number;
  isPriorityOpen: boolean;
  isUrgent: number;
  onDurationToggle: () => void;
  onEtcClick: (event: Event) => void;
  onPriorityToggle: () => void;
  setIsImportant: (next: number) => void;
  setIsUrgent: (next: number) => void;
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
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    DEFAULT_ESTIMATED_MINUTES
  );
  const [isUrgent, setIsUrgent] = useState(0);
  const [isImportant, setIsImportant] = useState(0);
  const [isDurationOpen, setIsDurationOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);

  useEffect(() => {
    const openQuickAdd = () => {
      setError(null);
      setEstimatedMinutes(DEFAULT_ESTIMATED_MINUTES);
      setIsUrgent(0);
      setIsImportant(0);
      setIsDurationOpen(false);
      setIsPriorityOpen(false);
      formRef.current?.reset();
      // Native dialog: showModal() then focus title after the modal paints.
      dialogRef.current?.showModal();
      queueMicrotask(() => {
        titleRef.current?.focus();
      });
    };

    const triggers = TRIGGER_IDS.map((id) => document.querySelector(`#${id}`));
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

  const onDurationToggle = useCallback(() => {
    setIsDurationOpen((open) => !open);
  }, []);

  const onPriorityToggle = useCallback(() => {
    setIsPriorityOpen((open) => !open);
  }, []);

  const onEtcClick = useCallback((event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    setEstimatedMinutes(Number(button.dataset.etc));
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
          estimatedMinutes,
          isUrgent,
          isImportant,
          ...(rawProjectId.length > 0 ? { projectId: rawProjectId } : {}),
          ...readOptionalDueFields(form),
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
    [estimatedMinutes, isImportant, isUrgent]
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
    if (!form?.reportValidity()) {
      return;
    }
    await createTask(form, true);
  }, [createTask]);

  return {
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
  };
}
