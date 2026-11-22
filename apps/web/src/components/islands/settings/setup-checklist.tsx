import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { orpc } from "../../lib/orpc";
import type { Project, Task } from "../../lib/task-helpers";

interface Props {
  capacitySet: boolean;
  dismissed: boolean;
  projects: Project[];
  tasks: Task[];
}

interface Step {
  done: boolean;
  href: string;
  id: string;
  label: string;
}

export default function SetupChecklist({
  tasks,
  projects,
  capacitySet: capacitySetProp,
  dismissed,
}: Props) {
  const [hidden, setHidden] = useState(dismissed);
  const [isSaving, setIsSaving] = useState(false);
  const [capacitySavedLocally, setCapacitySavedLocally] = useState(false);

  useEffect(() => {
    setCapacitySavedLocally(
      window.localStorage.getItem("plansage-capacity-saved") === "1"
    );
  }, []);

  const capacitySet = capacitySetProp || capacitySavedLocally;

  const steps: Step[] = useMemo(() => {
    const hasProject = projects.length > 0;
    const hasMatrixTask = tasks.some(
      (task) => !task.isCompleted && (task.isUrgent > 0 || task.isImportant > 0)
    );
    const hasStaged = tasks.some((task) => task.isToday);
    const hasCompleted = tasks.some((task) => task.isCompleted);
    return [
      {
        done: capacitySet,
        href: "/settings",
        id: "capacity",
        label: "Set daily capacity (2–8h)",
      },
      {
        done: hasProject,
        href: "/projects",
        id: "project",
        label: "Create a project",
      },
      {
        done: hasMatrixTask,
        href: "/matrix",
        id: "matrix",
        label: "Place a task on the Matrix",
      },
      {
        done: hasStaged,
        href: "/today",
        id: "stage",
        label: "Stage something into Today",
      },
      {
        done: hasCompleted,
        href: "/today",
        id: "complete",
        label: "Complete one Today task",
      },
    ];
  }, [capacitySet, projects.length, tasks]);

  const allDone = steps.every((step) => step.done);

  const dismiss = useCallback(async () => {
    setIsSaving(true);
    try {
      await orpc.preferences.completeOnboarding();
      setHidden(true);
    } catch {
      setHidden(true);
    } finally {
      setIsSaving(false);
    }
  }, []);

  if (hidden) {
    return null;
  }

  return (
    <section className="rounded-md border border-border-contrast bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-primary">Get set up</h2>
          <p className="mt-1 text-sm text-text-secondary">
            A short path to your first capacity-honest day.
          </p>
        </div>
        <button
          className="min-h-11 shrink-0 rounded-sm px-3 text-sm text-text-secondary hover:text-text-primary"
          disabled={isSaving}
          onClick={dismiss}
          type="button"
        >
          Dismiss
        </button>
      </div>
      <ol className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.id}>
            <a
              className="flex min-h-11 items-center gap-3 rounded-sm px-2 text-sm hover:bg-surface-elevated"
              href={step.href}
            >
              <span
                aria-hidden="true"
                className={
                  step.done
                    ? "flex size-5 items-center justify-center rounded-full bg-capacity-ok text-[10px] text-on-primary"
                    : "flex size-5 items-center justify-center rounded-full border border-border-contrast text-text-muted"
                }
              >
                {step.done ? "✓" : ""}
              </span>
              <span
                className={
                  step.done
                    ? "text-text-muted line-through"
                    : "text-text-primary"
                }
              >
                {step.label}
              </span>
            </a>
          </li>
        ))}
      </ol>
      {allDone ? (
        <button
          className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-primary px-4 font-semibold text-on-primary text-sm disabled:opacity-60"
          disabled={isSaving}
          onClick={dismiss}
          type="button"
        >
          Mark setup complete
        </button>
      ) : null}
    </section>
  );
}
