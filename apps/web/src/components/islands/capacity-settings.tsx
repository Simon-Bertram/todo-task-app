import { useCallback, useState } from "preact/hooks";
import { orpc } from "../../lib/orpc";

const MIN = 120;
const MAX = 480;
const STEP = 30;
const DEFAULT = 300;

interface Props {
  initialMinutes?: number;
}

export default function CapacitySettings({ initialMinutes = DEFAULT }: Props) {
  const [minutes, setMinutes] = useState(
    Math.min(MAX, Math.max(MIN, initialMinutes))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onInput = useCallback((event: Event) => {
    const value = Number((event.target as HTMLInputElement).value);
    const clamped = Math.min(MAX, Math.max(MIN, value));
    setMinutes(clamped);
    setSaved(false);
  }, []);

  const onSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      await orpc.preferences.updateDailyCapacity({
        dailyCapacityMinutes: minutes,
      });
      window.localStorage.setItem("plansage-capacity-saved", "1");
      setSaved(true);
      location.reload();
    } catch {
      setError("Could not save capacity. Try again.");
    } finally {
      setIsSaving(false);
    }
  }, [minutes]);

  return (
    <div className="space-y-4 rounded-md border border-border-contrast bg-surface p-5">
      <div>
        <h2 className="font-semibold text-text-primary">Daily capacity</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Focused hours for the Today board (2–8h). Saved to your account and
          used by Matrix and Today capacity bars.
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
      {error ? (
        <p className="text-capacity-over text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-capacity-ok text-sm" role="status">
          Capacity saved.
        </p>
      ) : null}
      <button
        className="inline-flex min-h-11 items-center rounded-sm bg-primary px-4 font-semibold text-on-primary text-sm disabled:opacity-60"
        disabled={isSaving}
        onClick={onSave}
        type="button"
      >
        {isSaving ? "Saving…" : "Save capacity"}
      </button>
    </div>
  );
}
