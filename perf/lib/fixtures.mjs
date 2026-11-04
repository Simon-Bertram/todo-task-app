import { PERF_PREFIX } from "./env.mjs";
import { isPerfTitle } from "./orpc.mjs";

export { isPerfTitle };

export async function cleanupPerfTasks(orpc) {
  const tasks = await orpc.tasks.list({ includeCompleted: true });
  const perfTasks = tasks.filter((task) => isPerfTitle(task.title));
  for (const task of perfTasks) {
    await orpc.tasks.delete({ id: task.id });
  }
  return perfTasks.length;
}

/**
 * @param {object} orpc
 * @param {"short" | "long"} kind
 * @param {number} count
 */
export async function seedPerfTasks(orpc, kind, count) {
  const estimatedMinutes = kind === "long" ? 90 : 30;
  const created = [];
  for (let i = 0; i < count; i += 1) {
    const title = `${PERF_PREFIX} ${kind} ${String(i + 1).padStart(2, "0")}`;
    const task = await orpc.tasks.create({
      estimatedMinutes,
      isImportant: kind === "long" ? 2 : 1,
      isToday: true,
      isUrgent: kind === "long" ? 2 : 0,
      progressPercent: kind === "long" ? 25 : 0,
      title,
    });
    created.push(task);
  }
  return created;
}
