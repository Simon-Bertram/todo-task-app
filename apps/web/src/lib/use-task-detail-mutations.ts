import { useCallback, useState } from "preact/hooks";
import { celebrateTaskComplete, completionIntensity } from "./celebrate";
import { orpc } from "./orpc";
import type { Project, Task } from "./task-helpers";
import { showToast } from "./toast";
import type { TaskDetailFormApi } from "./use-task-detail-form";

interface MutationOptions {
  baseTask: Task | null;
  budgetMinutes: number;
  close: () => void;
  confirmDelete: boolean;
  form: TaskDetailFormApi;
  localTasks: Task[];
  plannedMinutes: number;
  setConfirmDelete: (value: boolean) => void;
  setError: (value: string | null) => void;
  setLocalProjects: (
    value: Project[] | ((current: Project[]) => Project[])
  ) => void;
  setLocalTasks: (value: Task[] | ((current: Task[]) => Task[])) => void;
}

export function useTaskDetailMutations({
  baseTask,
  budgetMinutes,
  close,
  confirmDelete,
  form,
  localTasks,
  plannedMinutes,
  setConfirmDelete,
  setError,
  setLocalProjects,
  setLocalTasks,
}: MutationOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { values } = form;

  const onProgressPersisted = useCallback(
    (next: number) => {
      if (!baseTask) {
        return;
      }
      form.setProgressPercent(next);
      setLocalTasks((current) =>
        current.map((task) =>
          task.id === baseTask.id ? { ...task, progressPercent: next } : task
        )
      );
    },
    [baseTask, form, setLocalTasks]
  );

  const toggleToday = useCallback(async () => {
    if (!baseTask || isSaving || isDeleting) {
      return;
    }
    const nextIsToday = !values.isToday;
    form.setIsToday(nextIsToday);
    setIsSaving(true);
    setError(null);
    try {
      await orpc.tasks.update({
        estimatedMinutes: values.estimatedMinutes,
        id: baseTask.id,
        isImportant: values.isImportant,
        isToday: nextIsToday,
        isUrgent: values.isUrgent,
        recurrenceRule: values.recurrence,
      });
      setLocalTasks((current) =>
        current.map((task) =>
          task.id === baseTask.id ? { ...task, isToday: nextIsToday } : task
        )
      );
      close();
      showToast(
        nextIsToday ? "Added to Today" : "Removed from Today",
        "success"
      );
      location.reload();
    } catch {
      form.setIsToday(!nextIsToday);
      setError("Could not update Today status. Try again.");
      showToast("Could not update Today status. Try again.", "error");
    } finally {
      setIsSaving(false);
    }
  }, [
    baseTask,
    close,
    form,
    isDeleting,
    isSaving,
    setError,
    setLocalTasks,
    values.estimatedMinutes,
    values.isImportant,
    values.isToday,
    values.isUrgent,
    values.recurrence,
  ]);

  const toggleCompleted = useCallback(async () => {
    if (!baseTask || isSaving || isDeleting) {
      return;
    }
    const nextCompleted = !values.isCompleted;
    form.setIsCompleted(nextCompleted);
    setIsSaving(true);
    setError(null);
    try {
      const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
      const result = await orpc.tasks.update({
        id: baseTask.id,
        isCompleted: nextCompleted,
        timeZone,
      });
      if (nextCompleted) {
        const remainingTodayCount = localTasks.filter(
          (task) => task.isToday && !task.isCompleted && task.id !== baseTask.id
        ).length;
        await celebrateTaskComplete(
          completionIntensity({
            budgetMinutes,
            estimatedMinutes: values.estimatedMinutes,
            isToday: values.isToday,
            plannedMinutes,
            remainingTodayCount,
          })
        );
        if (result.unlockedMilestones && result.unlockedMilestones.length > 0) {
          showToast("Milestone unlocked", "success");
        } else {
          showToast("Task completed", "success");
        }
      } else {
        showToast("Task reopened", "success");
      }
      setLocalTasks((current) =>
        current.map((task) =>
          task.id === baseTask.id
            ? { ...task, isCompleted: nextCompleted }
            : task
        )
      );
      close();
      location.reload();
    } catch {
      form.setIsCompleted(!nextCompleted);
      setError("Could not update completion. Try again.");
      showToast("Could not update completion. Try again.", "error");
    } finally {
      setIsSaving(false);
    }
  }, [
    baseTask,
    budgetMinutes,
    close,
    form,
    isDeleting,
    isSaving,
    localTasks,
    plannedMinutes,
    setError,
    setLocalTasks,
    values.estimatedMinutes,
    values.isCompleted,
    values.isToday,
  ]);

  const onSave = useCallback(async () => {
    if (!baseTask || isSaving) {
      return;
    }
    const validationError = form.validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const input = form.toUpdateInput();
      await orpc.tasks.update({ id: baseTask.id, ...input });
      setLocalTasks((current) =>
        current.map((task) =>
          task.id === baseTask.id
            ? {
                ...task,
                dueDate: input.dueDate,
                estimatedMinutes: input.estimatedMinutes,
                isImportant: input.isImportant,
                isToday: input.isToday,
                isUrgent: input.isUrgent,
                notes: input.notes,
                projectId: input.projectId,
                recurrenceRule: input.recurrenceRule,
                title: input.title,
              }
            : task
        )
      );
      close();
      showToast("Task saved", "success");
      location.reload();
    } catch {
      setError("Could not save task. Try again.");
      showToast("Could not save task. Try again.", "error");
    } finally {
      setIsSaving(false);
    }
  }, [baseTask, close, form, isSaving, setError, setLocalTasks]);

  const onDelete = useCallback(async () => {
    if (!baseTask || isDeleting) {
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      await orpc.tasks.delete({ id: baseTask.id });
      setLocalTasks((current) =>
        current.filter((task) => task.id !== baseTask.id)
      );
      setConfirmDelete(false);
      close();
      showToast("Task deleted", "success");
      location.reload();
    } catch {
      setError("Could not delete task. Try again.");
      showToast("Could not delete task. Try again.", "error");
    } finally {
      setIsDeleting(false);
    }
  }, [
    baseTask,
    close,
    confirmDelete,
    isDeleting,
    setConfirmDelete,
    setError,
    setLocalTasks,
  ]);

  const onProjectNotesSaved = useCallback(
    (savedNotes: string | null) => {
      const { projectId } = values;
      if (!projectId) {
        return;
      }
      setLocalProjects((current) =>
        current.map((project) =>
          project.id === projectId ? { ...project, notes: savedNotes } : project
        )
      );
      showToast("Project notes saved", "success");
    },
    [setLocalProjects, values]
  );

  return {
    busy: isSaving || isDeleting,
    isDeleting,
    isSaving,
    onDelete,
    onProgressPersisted,
    onProjectNotesSaved,
    onSave,
    toggleCompleted,
    toggleToday,
  };
}
