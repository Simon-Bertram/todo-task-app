import { useCallback, useEffect, useState } from "preact/hooks";
import type {
  RecurrenceFormState,
  RecurrenceMode,
  RecurrenceWeekday,
} from "./recurrence-form";
import {
  buildRecurrenceRule,
  parseRecurrenceRule,
  recurrenceSummary,
} from "./recurrence-form";
import type { Task } from "./task-helpers";

export const TASK_DETAIL_ETC_PRESETS = [15, 30, 60, 90, 120] as const;
export const TASK_DETAIL_RATING = [0, 1, 2, 3] as const;
const DUE_TIME_PATTERN = /^\d{2}:\d{2}$/u;

export const TASK_DETAIL_RECURRENCE_MODES: Array<{
  label: string;
  value: RecurrenceMode;
}> = [
  { label: "None", value: "none" },
  { label: "Daily", value: "DAILY" },
  { label: "Weekdays", value: "WEEKDAYS" },
  { label: "Weekly", value: "WEEKLY" },
  { label: "Weekly on…", value: "WEEKLY_DAYS" },
  { label: "Monthly", value: "MONTHLY" },
  { label: "Every N days", value: "EVERY" },
];

export interface TaskDetailFormValues {
  dueDate: string | null;
  dueTime: string | null;
  estimatedMinutes: number;
  isCompleted: boolean;
  isImportant: number;
  isToday: boolean;
  isUrgent: number;
  notes: string;
  progressPercent: number;
  projectId: string | null;
  recurrence: RecurrenceFormState;
  title: string;
}

export function useTaskDetailForm(baseTask: Task | null) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(0);
  const [isImportant, setIsImportant] = useState(0);
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [progressPercent, setProgressPercent] = useState(0);
  const [recurrence, setRecurrence] = useState<RecurrenceFormState>(() =>
    parseRecurrenceRule(null)
  );
  const [isToday, setIsToday] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!baseTask) {
      return;
    }
    setTitle(baseTask.title);
    setNotes(baseTask.notes ?? "");
    setDueDate(baseTask.dueDate);
    setDueTime(baseTask.dueTime);
    setProjectId(baseTask.projectId);
    setIsUrgent(baseTask.isUrgent);
    setIsImportant(baseTask.isImportant);
    setEstimatedMinutes(baseTask.estimatedMinutes);
    setProgressPercent(baseTask.progressPercent);
    setIsToday(baseTask.isToday);
    setIsCompleted(baseTask.isCompleted);
    setRecurrence(parseRecurrenceRule(baseTask.recurrenceRule));
  }, [baseTask]);

  const onEtcClick = useCallback((event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    setEstimatedMinutes(Number(button.dataset.etc));
  }, []);

  const setRecurrenceMode = useCallback((mode: RecurrenceMode) => {
    setRecurrence((current) => ({ ...current, mode }));
  }, []);

  const onRecurrenceModeClick = useCallback((event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const raw = button.dataset.recurrence as RecurrenceMode | undefined;
    if (!raw) {
      return;
    }
    setRecurrence((current) => ({ ...current, mode: raw }));
  }, []);

  const toggleWeeklyDay = useCallback((day: RecurrenceWeekday) => {
    setRecurrence((current) => {
      const exists = current.weeklyDays.includes(day);
      const weeklyDays = exists
        ? current.weeklyDays.filter((item) => item !== day)
        : [...current.weeklyDays, day];
      return {
        ...current,
        mode: "WEEKLY_DAYS",
        weeklyDays: weeklyDays.length > 0 ? weeklyDays : [day],
      };
    });
  }, []);

  const onWeeklyDayClick = useCallback(
    (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const day = button.dataset.day as RecurrenceWeekday | undefined;
      if (day) {
        toggleWeeklyDay(day);
      }
    },
    [toggleWeeklyDay]
  );

  const onEveryDaysInput = useCallback((event: Event) => {
    const { value } = event.currentTarget as HTMLInputElement;
    const parsed = Number(value);
    setRecurrence((current) => ({
      ...current,
      everyDays: Number.isFinite(parsed) ? parsed : current.everyDays,
      mode: "EVERY",
    }));
  }, []);

  const onTitleInput = useCallback((event: Event) => {
    const { value } = event.currentTarget as HTMLInputElement;
    setTitle(value);
  }, []);

  const onNotesInput = useCallback((event: Event) => {
    const { value } = event.currentTarget as HTMLTextAreaElement;
    setNotes(value);
  }, []);

  const onDueTimeInput = useCallback((event: Event) => {
    const { value } = event.currentTarget as HTMLInputElement;
    setDueTime(value.trim() ? value : null);
  }, []);

  const onProjectChange = useCallback((event: Event) => {
    const { value } = event.currentTarget as HTMLSelectElement;
    setProjectId(value === "" ? null : value);
  }, []);

  const clearDueTime = useCallback(() => {
    setDueTime(null);
  }, []);

  const onDueDateChange = useCallback((next: string | null) => {
    setDueDate(next);
    if (!next) {
      setDueTime(null);
    }
  }, []);

  const values: TaskDetailFormValues = {
    dueDate,
    dueTime,
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
    if (dueTime && !dueDate) {
      return "Pick a due date before setting a due time.";
    }
    if (dueTime && !DUE_TIME_PATTERN.test(dueTime)) {
      return "Due time must be HH:MM.";
    }
    if (recurrence.mode === "EVERY" && recurrence.everyDays < 1) {
      return "Custom interval must be at least 1 day.";
    }
    return null;
  }, [dueDate, dueTime, recurrence.everyDays, recurrence.mode, title]);

  const toUpdateInput = useCallback(() => {
    const nextTitle = title.trim();
    return {
      dueDate,
      dueTime: dueDate ? dueTime : null,
      estimatedMinutes,
      isImportant,
      isToday,
      isUrgent,
      notes: notes.trim() ? notes.trim() : null,
      projectId,
      recurrenceRule: buildRecurrenceRule(recurrence),
      title: nextTitle,
    };
  }, [
    dueDate,
    dueTime,
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
    clearDueTime,
    onDueTimeInput,
    onEtcClick,
    onEveryDaysInput,
    onNotesInput,
    onProjectChange,
    onRecurrenceModeClick,
    onTitleInput,
    onWeeklyDayClick,
    recurrenceLabel: recurrenceSummary(recurrence),
    setDueDate: onDueDateChange,
    setDueTime,
    setIsCompleted,
    setIsImportant,
    setIsToday,
    setIsUrgent,
    setProgressPercent,
    setRecurrenceMode,
    toUpdateInput,
    validate,
    values,
  };
}

export type TaskDetailFormApi = ReturnType<typeof useTaskDetailForm>;
