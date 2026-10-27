import { useCallback, useEffect, useState } from "preact/hooks";

const STORAGE_KEY = "apex-daily-capacity-minutes";
const MIN = 120;
const MAX = 480;
const STEP = 30;
const DEFAULT = 300;

export default function CapacitySettings() {
  const [minutes, setMinutes] = useState(DEFAULT);

  useEffect(() => {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = Number.parseInt(stored, 10);
      if (!Number.isNaN(parsed) && parsed >= MIN && parsed <= MAX) {
        setMinutes(parsed);
      }
    }
  }, []);

  const onInput = useCallback((event: Event) => {
    const value = Number((event.target as HTMLInputElement).value);
    const clamped = Math.min(MAX, Math.max(MIN, value));
    setMinutes(clamped);
    globalThis.localStorage?.setItem(STORAGE_KEY, String(clamped));
  }, []);

  return (
    <div className="space-y-4 rounded-md border border-border-contrast bg-surface p-5">
      <div>
        <h2 className="font-semibold text-text-primary">Daily capacity</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Focused hours for the Today board (2–8h). Stored locally for this mock
          shell.
        </p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="tabular-metrics font-mono text-3xl text-primary">
          {(minutes / 60).toFixed(1)}
        </span>
        <span className="text-text-secondary">hours</span>
        <span className="tabular-metrics font-mono text-sm text-text-muted">
          ({minutes}m)
        </span>
      </div>
      <input
        aria-label="Daily capacity in minutes"
        className="w-full accent-primary"
        max={MAX}
        min={MIN}
        onInput={onInput}
        step={STEP}
        type="range"
        value={minutes}
      />
      <div className="flex justify-between font-mono text-text-muted text-xs">
        <span>2h</span>
        <span>5h default</span>
        <span>8h</span>
      </div>
    </div>
  );
}
