import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import type { Project, Task } from "./task-helpers";

export function useTaskDetailSheetController(
  initialTasks: Task[],
  projects: Project[]
) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [focusProgress, setFocusProgress] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localProjects, setLocalProjects] = useState(projects);
  const [localTasks, setLocalTasks] = useState(initialTasks);
  const progressSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setLocalProjects(projects);
  }, [projects]);

  useEffect(() => {
    setLocalTasks(initialTasks);
  }, [initialTasks]);

  const baseTask = useMemo(
    () => localTasks.find((task) => task.id === taskId) ?? null,
    [taskId, localTasks]
  );

  const openTask = useCallback((id: string, focus: string | null = null) => {
    setError(null);
    setConfirmDelete(false);
    setFocusProgress(focus === "progress");
    setTaskId(id);
  }, []);

  const close = useCallback(() => {
    setTaskId(null);
    setError(null);
    setConfirmDelete(false);
  }, []);

  const clearFocusProgress = useCallback(() => {
    setFocusProgress(false);
  }, []);

  useEffect(() => {
    function onOpen(event: Event) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest?.(".task-open") as HTMLElement | null;
      const id = button?.dataset.taskId;
      if (id) {
        openTask(id, button?.dataset.focus ?? null);
      }
    }

    function onOpenEvent(event: Event) {
      const custom = event as CustomEvent<{ focus?: string; taskId: string }>;
      const id = custom.detail?.taskId;
      if (id) {
        openTask(id, custom.detail.focus ?? null);
      }
    }

    document.addEventListener("click", onOpen);
    document.addEventListener("plansage:open-task", onOpenEvent);
    return () => {
      document.removeEventListener("click", onOpen);
      document.removeEventListener("plansage:open-task", onOpenEvent);
    };
  }, [openTask]);

  return {
    baseTask,
    clearFocusProgress,
    close,
    confirmDelete,
    error,
    focusProgress,
    localProjects,
    localTasks,
    openTask,
    progressSectionRef,
    setConfirmDelete,
    setError,
    setLocalProjects,
    setLocalTasks,
    setTaskId,
  };
}
