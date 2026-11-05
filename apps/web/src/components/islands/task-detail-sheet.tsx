import { useEffect } from "preact/hooks";
import type {
  Project,
  Task,
  TaskProgressControl,
} from "../../lib/task-helpers";
import { isLongTask } from "../../lib/task-helpers";
import { useTaskDetailForm } from "../../lib/use-task-detail-form";
import { useTaskDetailMutations } from "../../lib/use-task-detail-mutations";
import { useTaskDetailSheetController } from "../../lib/use-task-detail-sheet-controller";
import { TaskDetailForm } from "./task-detail-form";

interface Props {
  budgetMinutes: number;
  plannedMinutes: number;
  projects: Project[];
  taskProgressControl?: TaskProgressControl;
  tasks: Task[];
}

export default function TaskDetailSheet({
  tasks: initialTasks,
  projects,
  plannedMinutes,
  budgetMinutes,
  taskProgressControl = "pie",
}: Props) {
  const sheet = useTaskDetailSheetController(initialTasks, projects);
  const form = useTaskDetailForm(sheet.baseTask);
  const actions = useTaskDetailMutations({
    baseTask: sheet.baseTask,
    budgetMinutes,
    close: sheet.close,
    confirmDelete: sheet.confirmDelete,
    form,
    localTasks: sheet.localTasks,
    plannedMinutes,
    setConfirmDelete: sheet.setConfirmDelete,
    setError: sheet.setError,
    setLocalProjects: sheet.setLocalProjects,
    setLocalTasks: sheet.setLocalTasks,
  });

  useEffect(() => {
    if (
      !(
        sheet.focusProgress &&
        sheet.baseTask &&
        isLongTask(form.values.estimatedMinutes)
      )
    ) {
      return;
    }
    const node = sheet.progressSectionRef.current;
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = node?.querySelector<HTMLElement>(
      'button, input, [tabindex="0"]'
    );
    focusable?.focus();
    sheet.clearFocusProgress();
  }, [
    form.values.estimatedMinutes,
    sheet.baseTask,
    sheet.clearFocusProgress,
    sheet.focusProgress,
    sheet.progressSectionRef,
  ]);

  if (!sheet.baseTask) {
    return null;
  }

  return (
    <TaskDetailForm
      baseTask={sheet.baseTask}
      budgetMinutes={budgetMinutes}
      busy={actions.busy}
      confirmDelete={sheet.confirmDelete}
      error={sheet.error}
      form={form}
      isDeleting={actions.isDeleting}
      isSaving={actions.isSaving}
      onClose={sheet.close}
      onDelete={actions.onDelete}
      onProgressPersisted={actions.onProgressPersisted}
      onProjectNotesSaved={actions.onProjectNotesSaved}
      onSave={actions.onSave}
      plannedMinutes={plannedMinutes}
      progressSectionRef={sheet.progressSectionRef}
      projects={sheet.localProjects}
      taskProgressControl={taskProgressControl}
      toggleCompleted={actions.toggleCompleted}
      toggleToday={actions.toggleToday}
    />
  );
}
