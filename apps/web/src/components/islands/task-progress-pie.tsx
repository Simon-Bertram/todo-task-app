import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import {
  clampProgressPercent,
  filledQuarterCount,
  nextPieQuarter,
  persistTaskProgress,
  prefersReducedMotion,
  progressAriaLabel,
  progressFillCssVar,
} from "../../lib/task-progress";

export type ProgressSize = "compact" | "inline" | "sheet";

interface Props {
  interactive?: boolean;
  onOpenSheet?: () => void;
  onPersisted?: (percent: number) => void;
  progressPercent: number;
  size?: ProgressSize;
  taskId: string;
}

const QUARTER_PERCENTS = [25, 50, 75, 100] as const;
const QUARTER_POSITIONS = [
  "absolute top-0 left-1/2 z-10 h-1/2 w-1/2",
  "absolute top-1/2 left-1/2 z-10 h-1/2 w-1/2",
  "absolute top-1/2 left-0 z-10 h-1/2 w-1/2",
  "absolute top-0 left-0 z-10 h-1/2 w-1/2",
] as const;
const PIE_RADIUS = 48;
const PIE_CENTER = 50;

function piePx(size: ProgressSize): number {
  if (size === "sheet") {
    return 128;
  }
  if (size === "inline") {
    return 48;
  }
  return 36;
}

function polar(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function QuadrantHotspot({
  className,
  onSelect,
  percent,
}: {
  className: string;
  onSelect: (percent: number) => void;
  percent: number;
}) {
  const handleClick = useCallback(
    (event: Event) => {
      event.stopPropagation();
      onSelect(percent);
    },
    [onSelect, percent]
  );

  return (
    <button
      aria-label={`Set progress to ${percent} percent`}
      className={className}
      onClick={handleClick}
      type="button"
    />
  );
}

export default function TaskProgressPie({
  taskId,
  progressPercent,
  size = "compact",
  interactive = false,
  onOpenSheet,
  onPersisted,
}: Props) {
  const [percent, setPercent] = useState(clampProgressPercent(progressPercent));
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLButtonElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setPercent(clampProgressPercent(progressPercent));
  }, [progressPercent]);

  const filled = filledQuarterCount(percent);
  const fillColor = progressFillCssVar(percent);
  const visual = piePx(size);
  const isSheet = size === "sheet";

  const animateTo = useCallback(async (next: number, previous: number) => {
    if (prefersReducedMotion()) {
      return;
    }
    const gsap = (await import("gsap")).default;
    const root = rootRef.current;
    const svg = svgRef.current;
    // Refs are null before mount; guard for async animation after unmount.
    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref may be null
    if (!(root && svg)) {
      return;
    }

    const nextFilled = filledQuarterCount(next);
    const prevFilled = filledQuarterCount(previous);

    if (nextFilled > prevFilled) {
      for (let i = prevFilled; i < nextFilled; i += 1) {
        const sector = svg.querySelector(`[data-sector="${i}"]`);
        if (!sector) {
          continue;
        }
        gsap.fromTo(
          sector,
          { opacity: 0, scale: 0.92, transformOrigin: "50% 50%" },
          {
            duration: 0.35,
            ease: "back.out(1.4)",
            opacity: 1,
            overwrite: "auto",
            scale: 1,
          }
        );
      }
    }

    gsap.fromTo(
      root,
      { scale: 1 },
      {
        duration: 0.35,
        ease: "back.out(1.4)",
        overwrite: "auto",
        repeat: 1,
        scale: 1.02,
        yoyo: true,
      }
    );

    if (next >= 100 && previous < 100) {
      gsap.fromTo(
        root,
        { scale: 1 },
        {
          duration: 0.4,
          ease: "power2.out",
          overwrite: "auto",
          repeat: 1,
          scale: 1.06,
          yoyo: true,
        }
      );
    }
  }, []);

  const commit = useCallback(
    async (next: number) => {
      const previous = percent;
      const clamped = clampProgressPercent(next);
      setPercent(clamped);
      setSaving(true);
      await animateTo(clamped, previous);
      const ok = await persistTaskProgress(taskId, clamped);
      setSaving(false);
      if (!ok) {
        setPercent(previous);
        return;
      }
      onPersisted?.(clamped);
    },
    [animateTo, onPersisted, percent, taskId]
  );

  const handleAdvance = useCallback(() => {
    if (saving) {
      return;
    }
    if (!interactive) {
      onOpenSheet?.();
      return;
    }
    commit(nextPieQuarter(percent)).catch(() => {
      /* persistTaskProgress toasts */
    });
  }, [commit, interactive, onOpenSheet, percent, saving]);

  const handleQuadrant = useCallback(
    (target: number) => {
      if (!(interactive && isSheet) || saving) {
        return;
      }
      commit(target).catch(() => {
        /* persistTaskProgress toasts */
      });
    },
    [commit, interactive, isSheet, saving]
  );

  const hitClass =
    size === "compact"
      ? "inline-flex min-h-11 min-w-11 items-center justify-center"
      : "inline-flex items-center justify-center";

  return (
    <div
      className={
        isSheet
          ? "flex flex-col items-center gap-3"
          : "inline-flex flex-col items-center gap-1"
      }
    >
      {isSheet ? (
        <span className="font-medium text-sm text-text-secondary">
          Progress
        </span>
      ) : null}
      <div className="relative" style={{ height: visual, width: visual }}>
        <button
          aria-label={progressAriaLabel(percent)}
          className={hitClass}
          disabled={saving && interactive}
          onClick={handleAdvance}
          ref={rootRef}
          style={{ color: fillColor, height: visual, width: visual }}
          type="button"
        >
          <svg
            aria-hidden="true"
            height={visual}
            ref={svgRef}
            viewBox="0 0 100 100"
            width={visual}
          >
            <circle
              cx={PIE_CENTER}
              cy={PIE_CENTER}
              fill="none"
              r={PIE_RADIUS}
              stroke="var(--color-progress-empty)"
              strokeWidth="2"
            />
            {QUARTER_PERCENTS.map((target, index) => {
              const startAngle = -90 + index * 90;
              const endAngle = startAngle + 90;
              const start = polar(
                PIE_CENTER,
                PIE_CENTER,
                PIE_RADIUS,
                startAngle
              );
              const end = polar(PIE_CENTER, PIE_CENTER, PIE_RADIUS, endAngle);
              const d = `M ${PIE_CENTER} ${PIE_CENTER} L ${start.x} ${start.y} A ${PIE_RADIUS} ${PIE_RADIUS} 0 0 1 ${end.x} ${end.y} Z`;
              const isFilled = index < filled;
              return (
                <path
                  d={d}
                  data-sector={index}
                  fill={isFilled ? fillColor : "var(--color-progress-track)"}
                  key={target}
                  opacity={isFilled ? 1 : 0.55}
                />
              );
            })}
            <circle
              cx={PIE_CENTER}
              cy={PIE_CENTER}
              fill="var(--color-surface)"
              r={14}
            />
          </svg>
        </button>
        {interactive && isSheet
          ? QUARTER_PERCENTS.map((target, index) => (
              <QuadrantHotspot
                className={QUARTER_POSITIONS[index] ?? QUARTER_POSITIONS[0]}
                key={target}
                onSelect={handleQuadrant}
                percent={target}
              />
            ))
          : null}
      </div>
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
