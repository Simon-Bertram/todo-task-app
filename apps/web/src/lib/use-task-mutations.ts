import { useCallback } from "preact/hooks";
import { orpc } from "./orpc";
import { defaultRatingsForQuadrant, type QuadrantId } from "./quadrant";
import type { Task } from "./task-helpers";
import { showToast } from "./toast";

type SetTasks = (value: Task[] | ((current: Task[]) => Task[])) => void;

export type OptimisticTaskUpdate = (
  taskId: string,
  localPatch: Partial<Task>,
  remote: Omit<Parameters<typeof orpc.tasks.update>[0], "id">,
  messages?: { error?: string; success?: string }
) => Promise<boolean>;

function patchTaskInList(
  tasks: Task[],
  taskId: string,
  patch: Partial<Task>
): Task[] {
  return tasks.map((task) =>
    task.id === taskId ? { ...task, ...patch } : task
  );
}

/**
 * Optimistic local patch + `orpc.tasks.update` with rollback/toast.
 * `setBusy(taskId)` while in flight; `setBusy(null)` when idle.
 */
export function useOptimisticTaskUpdate(
  tasks: Task[],
  setTasks: SetTasks,
  isBusy: boolean,
  setBusy: (taskId: string | null) => void
): OptimisticTaskUpdate {
  return useCallback(
    async (taskId, localPatch, remote, messages) => {
      if (isBusy) {
        return false;
      }
      const previous = tasks;
      setTasks(patchTaskInList(tasks, taskId, localPatch));
      setBusy(taskId);
      try {
        await orpc.tasks.update({ id: taskId, ...remote });
        if (messages?.success) {
          showToast(messages.success, "success");
        }
        return true;
      } catch {
        setTasks(previous);
        showToast(
          messages?.error ?? "Could not update task. Try again.",
          "error"
        );
        return false;
      } finally {
        setBusy(null);
      }
    },
    [isBusy, setBusy, setTasks, tasks]
  );
}

export function useTodayFlag(updateTask: OptimisticTaskUpdate) {
  const addToToday = useCallback(
    async (taskId: string) => {
      await updateTask(
        taskId,
        { isToday: true },
        { isToday: true },
        {
          error: "Could not add to Today. Try again.",
          success: "Added to Today",
        }
      );
    },
    [updateTask]
  );

  const removeFromToday = useCallback(
    async (taskId: string) => {
      await updateTask(
        taskId,
        { isToday: false },
        { isToday: false },
        {
          error: "Could not remove from Today. Try again.",
          success: "Removed from Today",
        }
      );
    },
    [updateTask]
  );

  return { addToToday, removeFromToday };
}

export function useMoveTaskToQuadrant(updateTask: OptimisticTaskUpdate) {
  return useCallback(
    async (taskId: string, quadrant: QuadrantId) => {
      const ratings = defaultRatingsForQuadrant(quadrant);
      return await updateTask(
        taskId,
        {
          isImportant: ratings.isImportant,
          isUrgent: ratings.isUrgent,
        },
        {
          isImportant: ratings.isImportant,
          isUrgent: ratings.isUrgent,
        },
        { error: "Could not move task. Try again." }
      );
    },
    [updateTask]
  );
}
