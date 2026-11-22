import { useEffect, useState } from "preact/hooks";
import { orpc } from "./orpc";

export interface MilestoneRow {
  key: string;
  label: string;
  unlockedAt: Date | string | null;
}

export interface WeeklyStats {
  daysOverCapacity: number;
  daysProtected: number;
  q2Completed: number;
  q3Completed: number;
  weekEnd: string;
  weekStart: string;
}

interface Options {
  initialBest: number;
  initialCurrent: number;
  initialOptIn: boolean;
}

export function useGamificationSettingsData({
  initialBest,
  initialCurrent,
  initialOptIn,
}: Options) {
  const [rhythmOptIn, setRhythmOptIn] = useState(initialOptIn);
  const [current, setCurrent] = useState(initialCurrent);
  const [best, setBest] = useState(initialBest);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
    let cancelled = false;
    Promise.all([
      orpc.gamification.listMilestones(),
      orpc.gamification.weeklyIntentionality({ timeZone }),
      orpc.gamification.getRhythm(),
    ])
      .then(([milestoneRows, weeklyStats, rhythm]) => {
        if (cancelled) {
          return;
        }
        setMilestones(milestoneRows);
        setWeekly(weeklyStats);
        setCurrent(rhythm.current);
        setBest(rhythm.best);
        setRhythmOptIn(rhythm.optIn);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load rhythm and milestones.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    best,
    current,
    error,
    milestones,
    rhythmOptIn,
    setCurrent,
    setError,
    setRhythmOptIn,
    weekly,
  };
}
