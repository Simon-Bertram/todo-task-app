import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import {
  clampProgressPercent,
  persistTaskProgress,
  prefersReducedMotion,
  progressAriaLabel,
  progressFillCssVar,
} from "../../lib/task-progress";
import type { ProgressSize } from "./task-progress-pie";

interface Props {
  interactive?: boolean;
  onOpenSheet?: () => void;
  onPersisted?: (percent: number) => void;
  progressPercent: number;
  size?: ProgressSize;
  taskId: string;
}

function snapToStep(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value / 5) * 5));
}

export default function TaskProgressSlider({
  taskId,
  progressPercent,
  size = "compact",
  interactive = false,
  onOpenSheet,
  onPersisted,
}: Props) {
  const [percent, setPercent] = useState(
    snapToStep(clampProgressPercent(progressPercent))
  );
  const [saving, setSaving] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPercent(snapToStep(clampProgressPercent(progressPercent)));
  }, [progressPercent]);

  const fillColor = progressFillCssVar(percent);
  const isSheet = size === "sheet";
  const isCompact = size === "compact";

  const animateBar = useCallback(async (next: number) => {
    const fill = fillRef.current;
    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref may be null
    if (!fill) {
      return;
    }
    if (prefersReducedMotion()) {
      fill.style.width = `${next}%`;
      fill.style.backgroundColor = progressFillCssVar(next);
      return;
    }
    const gsap = (await import("gsap")).default;
    gsap.to(fill, {
      backgroundColor: progressFillCssVar(next),
      duration: 0.25,
      ease: "power3.out",
      overwrite: "auto",
      width: `${next}%`,
    });
    if (next < 100) {
      return;
    }
    const bar = barRef.current;
    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref may be null
    if (!bar) {
      return;
    }
    gsap.fromTo(
      bar,
      { scaleY: 1 },
      {
        duration: 0.35,
        ease: "power2.out",
        overwrite: "auto",
        repeat: 1,
        scaleY: 1.15,
        transformOrigin: "center center",
        yoyo: true,
      }
    );
  }, []);

  useEffect(() => {
    animateBar(percent).catch(() => {
      /* animation best-effort */
    });
  }, [animateBar, percent]);

  const commit = useCallback(
    async (next: number) => {
      const previous = percent;
      const snapped = snapToStep(next);
      setPercent(snapped);
      setSaving(true);
      const ok = await persistTaskProgress(taskId, snapped);
      setSaving(false);
      if (!ok) {
        setPercent(previous);
        return;
      }
      onPersisted?.(snapped);
    },
    [onPersisted, percent, taskId]
  );

  const handleOpenSheet = useCallback(
    (event: Event) => {
      event.stopPropagation();
      onOpenSheet?.();
    },
    [onOpenSheet]
  );

  const handleInput = useCallback((event: Event) => {
    const next = snapToStep(Number((event.target as HTMLInputElement).value));
    setPercent(next);
  }, []);

  const handleCommit = useCallback(
    (event: Event) => {
      const next = snapToStep(Number((event.target as HTMLInputElement).value));
      commit(next).catch(() => {
        /* persistTaskProgress toasts */
      });
    },
    [commit]
  );

  if (!interactive) {
    return (
      <button
        aria-label={progressAriaLabel(percent)}
        className={
          isCompact
            ? "flex min-h-11 w-full flex-col justify-center gap-1"
            : "flex w-full flex-col gap-1"
        }
        onClick={handleOpenSheet}
        type="button"
      >
        <div
          className={`w-full overflow-hidden rounded-full bg-progress-track ${
            isCompact ? "h-1.5" : "h-2"
          }`}
          ref={barRef}
        >
          <div
            className="h-full rounded-full"
            ref={fillRef}
            style={{
              backgroundColor: fillColor,
              width: `${percent}%`,
            }}
          />
        </div>
        {isCompact ? null : (
          <span className="tabular-metrics text-text-secondary text-xs">
            {percent}%
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={`flex w-full flex-col ${isSheet ? "gap-3" : "gap-2"}`}>
      {isSheet ? (
        <span className="font-medium text-sm text-text-secondary">
          Progress
        </span>
      ) : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-progress-track"
        ref={barRef}
      >
        <div
          className="h-full rounded-full"
          ref={fillRef}
          style={{
            backgroundColor: fillColor,
            width: `${percent}%`,
          }}
        />
      </div>
      <label className="flex w-full flex-col gap-2">
        <span className="sr-only">{progressAriaLabel(percent)}</span>
        <input
          aria-label={progressAriaLabel(percent)}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percent}
          className="h-11 w-full cursor-pointer touch-pan-y accent-progress-mid"
          disabled={saving}
          max={100}
          min={0}
          onChange={handleCommit}
          onInput={handleInput}
          onPointerUp={handleCommit}
          step={5}
          style={{ touchAction: "pan-y" }}
          type="range"
          value={percent}
        />
      </label>
      <span
        className={`tabular-metrics text-text-secondary ${
          isSheet ? "text-sm" : "text-xs"
        }`}
      >
        {percent}%
      </span>
    </div>
  );
}
