import { useCallback, useEffect, useState } from "preact/hooks";
import type { Task } from "./task-helpers";

export const TASK_DETAIL_ETC_PRESETS = [15, 30, 60, 90, 120] as const;
export const TASK_DETAIL_RATING = [0, 1, 2, 3] as const;
export const TASK_DETAIL_RECURRENCE = [
  { label: "None", value: null },
  { label: "Daily", value: "DAILY" },
  { label: "Weekdays", value: "WEEKDAYS" },
  { label: "Weekly", value: "WEEKLY" },
  { label: "Monthly", value: "MONTHLY" },
] as const;

export type TaskDetailRecurrence =
  (typeof TASK_DETAIL_RECURRENCE)[number]["value"];

export interface TaskDetailFormValues {
  dueDate: string | null;
  estimatedMinutes: number;
  isCompleted: boolean;
  isImportant: number;
  isToday: boolean;
  isUrgent: number;
  notes: string;
  progressPercent: number;
  projectId: string | null;
  recurrence: TaskDetailRecurrence;
  title: string;
}

export function useTaskDetailForm(baseTask: Task | null) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(0);
  const [isImportant, setIsImportant] = useState(0);
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [progressPercent, setProgressPercent] = useState(0);
  const [recurrence, setRecurrence] = useState<TaskDetailRecurrence>(null);
  const [isToday, setIsToday] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!baseTask) {
      return;
    }
    setTitle(baseTask.title);
    setNotes(baseTask.notes ?? "");
    setDueDate(baseTask.dueDate);
    setProjectId(baseTask.projectId);
    setIsUrgent(baseTask.isUrgent);
    setIsImportant(baseTask.isImportant);
    setEstimatedMinutes(baseTask.estimatedMinutes);
    setProgressPercent(baseTask.progressPercent);
    setIsToday(baseTask.isToday);
    setIsCompleted(baseTask.isCompleted);
    setRecurrence(
      TASK_DETAIL_RECURRENCE.find(
        (rule) => rule.value === baseTask.recurrenceRule
      )?.value ?? null
    );
  }, [baseTask]);

  const onEtcClick = useCallback((event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    setEstimatedMinutes(Number(button.dataset.etc));
  }, []);

  const onRecurrenceClick = useCallback((event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const raw = button.dataset.recurrence;
    if (raw === "null" || raw === undefined || raw === "") {
      setRecurrence(null);
      return;
    }
    setRecurrence(raw as Exclude<TaskDetailRecurrence, null>);
  }, []);

  const onTitleInput = useCallback((event: Event) => {
    const { value } = event.currentTarget as HTMLInputElement;
    setTitle(value);
  }, []);

  const onNotesInput = useCallback((event: Event) => {
    const { value } = event.currentTarget as HTMLTextAreaElement;
    setNotes(value);
  }, []);

  const onProjectChange = useCallback((event: Event) => {
    const { value } = event.currentTarget as HTMLSelectElement;
    setProjectId(value === "" ? null : value);
  }, []);

  const values: TaskDetailFormValues = {
    dueDate,
    estimatedMinutes,
    isCompleted,
    isImportant,
    isToday,
    isUrgent,
    notes,
    progressPercent,
    projectId,
    recurrence,
    title,
  };

  const validate = useCallback((): string | null => {
    if (!title.trim()) {
      return "Title is required.";
    }
    return null;
  }, [title]);

  const toUpdateInput = useCallback(() => {
    const nextTitle = title.trim();
    return {
      dueDate,
      estimatedMinutes,
      isImportant,
      isToday,
      isUrgent,
      notes: notes.trim() ? notes.trim() : null,
      projectId,
      recurrenceRule: recurrence,
      title: nextTitle,
    };
  }, [
    dueDate,
    estimatedMinutes,
    isImportant,
    isToday,
    isUrgent,
    notes,
    projectId,
    recurrence,
    title,
  ]);

  return {
    onEtcClick,
    onNotesInput,
    onProjectChange,
    onRecurrenceClick,
    onTitleInput,
    setDueDate,
    setIsCompleted,
    setIsImportant,
    setIsToday,
    setIsUrgent,
    setProgressPercent,
    toUpdateInput,
    validate,
    values,
  };
}

export type TaskDetailFormApi = ReturnType<typeof useTaskDetailForm>;
