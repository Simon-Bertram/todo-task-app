import { useEffect, useState } from "preact/hooks";

import type { Task } from "./task-helpers";
import {
  TASK_PROGRESS_UPDATED_EVENT,
  type TaskProgressUpdatedDetail,
} from "./task-progress";

/** Keep local task list in sync when progress islands persist. */
export function useTaskProgressSync(
  setTasks: (updater: (current: Task[]) => Task[]) => void
): void {
  useEffect(() => {
    function onProgress(event: Event) {
      const { detail } = event as CustomEvent<TaskProgressUpdatedDetail>;
      if (!(detail?.taskId && typeof detail.progressPercent === "number")) {
        return;
      }
      const { taskId, progressPercent } = detail;
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, progressPercent } : task
        )
      );
    }
    document.addEventListener(TASK_PROGRESS_UPDATED_EVENT, onProgress);
    return () => {
      document.removeEventListener(TASK_PROGRESS_UPDATED_EVENT, onProgress);
    };
  }, [setTasks]);
}

/** Tailwind `lg` breakpoint — desktop inline interactive progress. */
export function useIsDesktopLg(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}
