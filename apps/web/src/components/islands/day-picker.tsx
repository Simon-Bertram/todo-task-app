import { useCallback, useMemo, useState } from "preact/hooks";
import {
  buildMonthGrid,
  formatDateOnly,
  MONTH_LABELS,
  parseDateOnly,
  WEEKDAY_LABELS,
} from "../../lib/due-date";
import { getLocalDateString } from "../../lib/task-helpers";

interface Props {
  onChange: (next: string | null) => void;
  value: string | null;
}

export default function DayPicker({ value, onChange }: Props) {
  const today = getLocalDateString();
  const selected = value ? parseDateOnly(value) : null;
  const initial = selected ?? new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const cells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewMonth, viewYear]
  );

  const goPrev = useCallback(() => {
    setViewMonth((month) => {
      if (month === 0) {
        setViewYear((year) => year - 1);
        return 11;
      }
      return month - 1;
    });
  }, []);

  const goNext = useCallback(() => {
    setViewMonth((month) => {
      if (month === 11) {
        setViewYear((year) => year + 1);
        return 0;
      }
      return month + 1;
    });
  }, []);

  const goToday = useCallback(() => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    onChange(getLocalDateString(now));
  }, [onChange]);

  const clear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  const onDayClick = useCallback(
    (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const iso = button.dataset.date;
      if (!iso) {
        return;
      }
      onChange(iso);
    },
    [onChange]
  );

  return (
    <div className="space-y-3 rounded-sm border border-border-contrast bg-surface-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          aria-label="Previous month"
          className="flex size-11 items-center justify-center rounded-sm border border-border-contrast text-text-secondary hover:bg-surface-elevated"
          onClick={goPrev}
          type="button"
        >
          ‹
        </button>
        <p className="font-medium text-sm text-text-primary">
          {MONTH_LABELS[viewMonth]} {viewYear}
        </p>
        <button
          aria-label="Next month"
          className="flex size-11 items-center justify-center rounded-sm border border-border-contrast text-text-secondary hover:bg-surface-elevated"
          onClick={goNext}
          type="button"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((label) => (
          <span
            className="font-mono text-[10px] text-text-muted uppercase"
            key={label}
          >
            {label}
          </span>
        ))}
        {cells
          .filter((cell): cell is Date => cell !== null)
          .map((cell, dayIndex) => {
            const iso = formatDateOnly(cell);
            const isSelected = value === iso;
            const isToday = today === iso;
            let dayClass = "text-text-primary hover:bg-surface-elevated";
            if (isSelected) {
              dayClass = "bg-primary font-semibold text-on-primary";
            } else if (isToday) {
              dayClass = "border border-primary text-primary";
            }
            const style =
              dayIndex === 0
                ? { gridColumnStart: cell.getDay() + 1 }
                : undefined;
            return (
              <button
                aria-current={isSelected ? "date" : undefined}
                aria-label={iso}
                className={`flex min-h-11 items-center justify-center rounded-sm font-mono text-sm ${dayClass}`}
                data-date={iso}
                key={iso}
                onClick={onDayClick}
                style={style}
                type="button"
              >
                {cell.getDate()}
              </button>
            );
          })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex min-h-11 items-center rounded-sm border border-border-contrast px-3 text-sm text-text-secondary hover:bg-surface-elevated"
          onClick={goToday}
          type="button"
        >
          Today
        </button>
        <button
          className="inline-flex min-h-11 items-center rounded-sm border border-border-contrast px-3 text-sm text-text-secondary hover:bg-surface-elevated"
          disabled={value === null}
          onClick={clear}
          type="button"
        >
          Clear
        </button>
        {value ? (
          <span className="ml-auto self-center font-mono text-text-muted text-xs">
            Selected {value}
          </span>
        ) : (
          <span className="ml-auto self-center font-mono text-text-muted text-xs">
            No due date
          </span>
        )}
      </div>
    </div>
  );
}
