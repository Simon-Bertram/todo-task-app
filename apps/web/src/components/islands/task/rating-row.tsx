import { useCallback } from "preact/hooks";

import { TASK_DETAIL_RATING } from "@/lib/tasks/use-task-detail-form";

/** 0–3 rating control shared by Urgency and Importance. */
export default function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  onChange: (next: number) => void;
  value: number;
}) {
  const onClick = useCallback(
    (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      onChange(Number(button.dataset.rating));
    },
    [onChange]
  );

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className="tabular-metrics font-mono text-text-muted text-xs">
          {value}/3
        </span>
      </div>
      <div className="flex gap-1">
        {TASK_DETAIL_RATING.map((rating) => {
          const selected = value === rating;
          return (
            <button
              className={`min-h-11 flex-1 rounded-sm border font-mono text-sm ${
                selected
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border-contrast bg-canvas/40 text-text-secondary"
              }`}
              data-rating={rating}
              key={rating}
              onClick={onClick}
              type="button"
            >
              {rating}
            </button>
          );
        })}
      </div>
    </div>
  );
}
