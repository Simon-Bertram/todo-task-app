import type { TaskProgressControl } from "../../lib/task-helpers";
import { openTaskSheet } from "../../lib/task-progress";
import TaskProgressPie, { type ProgressSize } from "./task-progress-pie";
import TaskProgressSlider from "./task-progress-slider";

interface Props {
  control: TaskProgressControl;
  interactive?: boolean;
  onPersisted?: (percent: number) => void;
  progressPercent: number;
  size?: ProgressSize;
  taskId: string;
}

export default function TaskProgress({
  control,
  taskId,
  progressPercent,
  size = "compact",
  interactive = false,
  onPersisted,
}: Props) {
  const handleOpenSheet = () => {
    openTaskSheet(taskId, "progress");
  };

  if (control === "slider") {
    return (
      <TaskProgressSlider
        interactive={interactive}
        onOpenSheet={handleOpenSheet}
        onPersisted={onPersisted}
        progressPercent={progressPercent}
        size={size}
        taskId={taskId}
      />
    );
  }

  return (
    <TaskProgressPie
      interactive={interactive}
      onOpenSheet={handleOpenSheet}
      onPersisted={onPersisted}
      progressPercent={progressPercent}
      size={size}
      taskId={taskId}
    />
  );
}
