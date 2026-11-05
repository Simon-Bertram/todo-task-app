import { useCallback, useEffect, useState } from "preact/hooks";
import {
  type CelebrationsPref,
  setCelebrationsPref,
} from "../../lib/celebrate";
import { orpc } from "../../lib/orpc";
import type { TaskProgressControl } from "../../lib/task-helpers";
import { useGamificationSettingsData } from "../../lib/use-gamification-settings-data";

interface Props {
  initialCelebrations: CelebrationsPref;
  initialRhythmOptIn: boolean;
  initialTaskProgressControl?: TaskProgressControl;
  rhythmBest: number;
  rhythmCurrent: number;
}

export default function GamificationSettings({
  initialCelebrations,
  initialRhythmOptIn,
  initialTaskProgressControl = "pie",
  rhythmBest,
  rhythmCurrent,
}: Props) {
  const [celebrations, setCelebrations] =
    useState<CelebrationsPref>(initialCelebrations);
  const [taskProgressControl, setTaskProgressControl] =
    useState<TaskProgressControl>(initialTaskProgressControl);
  const [status, setStatus] = useState<string | null>(null);
  const {
    best,
    current,
    error,
    milestones,
    rhythmOptIn,
    setCurrent,
    setError,
    setRhythmOptIn,
    weekly,
  } = useGamificationSettingsData({
    initialBest: rhythmBest,
    initialCurrent: rhythmCurrent,
    initialOptIn: initialRhythmOptIn,
  });

  useEffect(() => {
    setCelebrationsPref(initialCelebrations);
  }, [initialCelebrations]);

  const onCelebrationsChange = useCallback(
    async (event: Event) => {
      const { value } = event.currentTarget as HTMLSelectElement;
      const next = value as CelebrationsPref;
      setCelebrations(next);
      setCelebrationsPref(next);
      setStatus(null);
      try {
        await orpc.preferences.updateCelebrations({ celebrations: next });
        setStatus("Celebrations saved.");
      } catch {
        setError("Could not save celebrations.");
      }
    },
    [setError]
  );

  const onTaskProgressControlChange = useCallback(
    async (event: Event) => {
      const { value } = event.currentTarget as HTMLSelectElement;
      const next = value as TaskProgressControl;
      setTaskProgressControl(next);
      setStatus(null);
      try {
        await orpc.preferences.updateTaskProgressControl({
          taskProgressControl: next,
        });
        setStatus("Progress control saved.");
      } catch {
        setError("Could not save progress control.");
      }
    },
    [setError]
  );

  const onRhythmToggle = useCallback(
    async (event: Event) => {
      const { checked } = event.currentTarget as HTMLInputElement;
      setRhythmOptIn(checked);
      setStatus(null);
      try {
        await orpc.gamification.setRhythmOptIn({ optIn: checked });
        setStatus(
          checked ? "Rhythm opted in." : "Rhythm paused preference saved."
        );
        if (!checked) {
          setCurrent(0);
        }
      } catch {
        setError("Could not update rhythm preference.");
        setRhythmOptIn(!checked);
      }
    },
    [setCurrent, setError, setRhythmOptIn]
  );

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-md border border-border-contrast bg-surface p-5">
        <div>
          <h2 className="font-semibold text-text-primary">Celebrations</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Subtle confetti on task complete. Respects reduced-motion.
          </p>
        </div>
        <label className="block space-y-1.5">
          <span className="font-medium text-sm text-text-secondary">
            Motion
          </span>
          <select
            className="min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 text-text-primary"
            onChange={onCelebrationsChange}
            value={celebrations}
          >
            <option value="subtle">Subtle</option>
            <option value="off">Off</option>
          </select>
        </label>
      </section>

      <section className="space-y-4 rounded-md border border-border-contrast bg-surface p-5">
        <div>
          <h2 className="font-semibold text-text-primary">
            Long-task progress
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Control shown on tasks with ETC over 60 minutes. Applies app-wide.
          </p>
        </div>
        <label className="block space-y-1.5">
          <span className="font-medium text-sm text-text-secondary">
            Progress UI
          </span>
          <select
            className="min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 text-text-primary"
            onChange={onTaskProgressControlChange}
            value={taskProgressControl}
          >
            <option value="pie">Quartered pie</option>
            <option value="slider">Percentage slider</option>
          </select>
        </label>
      </section>

      <section className="space-y-4 rounded-md border border-border-contrast bg-surface p-5">
        <div>
          <h2 className="font-semibold text-text-primary">
            Protected-day rhythm
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Opt-in consecutive days finished under capacity. Missing a day shows
            “rhythm paused” — no freezes or shop.
          </p>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm text-text-primary">
          <input
            checked={rhythmOptIn}
            className="size-4 accent-primary"
            onChange={onRhythmToggle}
            type="checkbox"
          />
          Track protected-day rhythm
        </label>
        {rhythmOptIn ? (
          <p className="font-mono text-sm text-text-secondary">
            Current: {current} · Best: {best}
            {current === 0 ? " · Rhythm paused" : ""}
          </p>
        ) : null}
      </section>

      <section className="space-y-4 rounded-md border border-border-contrast bg-surface p-5">
        <div>
          <h2 className="font-semibold text-text-primary">Milestones</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Private unlocks — no public flair.
          </p>
        </div>
        <ul className="space-y-2">
          {milestones.map((row) => (
            <li
              className="flex min-h-11 items-center justify-between gap-3 rounded-sm border border-border-subtle px-3 text-sm"
              key={row.key}
            >
              <span
                className={
                  row.unlockedAt ? "text-text-primary" : "text-text-muted"
                }
              >
                {row.label}
              </span>
              <span className="font-mono text-text-muted text-xs">
                {row.unlockedAt ? "Unlocked" : "Locked"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-md border border-border-contrast bg-surface p-5">
        <div>
          <h2 className="font-semibold text-text-primary">
            This week’s intentionality
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Reflection on Q2 vs Q3 and protected days — not a scoreboard.
          </p>
        </div>
        {weekly ? (
          <dl className="grid grid-cols-2 gap-3 font-mono text-sm">
            <div>
              <dt className="text-text-muted text-xs">Week</dt>
              <dd className="text-text-primary">
                {weekly.weekStart} → {weekly.weekEnd}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted text-xs">Q2 / Q3 completed</dt>
              <dd className="text-text-primary">
                {weekly.q2Completed} / {weekly.q3Completed}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted text-xs">Protected days</dt>
              <dd className="text-text-primary">{weekly.daysProtected}</dd>
            </div>
            <div>
              <dt className="text-text-muted text-xs">Over-capacity days</dt>
              <dd className="text-text-primary">{weekly.daysOverCapacity}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-text-muted">Loading…</p>
        )}
      </section>

      {error ? (
        <p className="text-capacity-over text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="text-capacity-ok text-sm" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
