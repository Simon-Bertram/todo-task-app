import type { TasksBoardPrefs } from "@todo-task-app/api/schemas/tasks-board-prefs";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { orpc } from "./orpc";
import { prefsToSearchParams } from "./task-helpers";

const DEBOUNCE_MS = 400;

function syncPrefsToUrl(prefs: TasksBoardPrefs, query: string): void {
  const params = prefsToSearchParams(prefs, query);
  const next = params.toString();
  const url = new URL(window.location.href);
  const current = url.searchParams.toString();
  if (next === current) {
    return;
  }
  const path = next ? `${url.pathname}?${next}` : url.pathname;
  window.history.replaceState({}, "", path);
}

export function useTasksBoardPrefs(
  initialPrefs: TasksBoardPrefs,
  initialQuery: string
) {
  const [prefs, setPrefs] = useState<TasksBoardPrefs>(initialPrefs);
  const [query, setQuery] = useState(initialQuery);
  const persistGeneration = useRef(0);

  useEffect(() => {
    syncPrefsToUrl(prefs, query);
  }, [prefs, query]);

  useEffect(() => {
    const generation = persistGeneration.current + 1;
    persistGeneration.current = generation;
    if (generation === 1) {
      return;
    }

    const handle = globalThis.setTimeout(() => {
      orpc.preferences.updateTasksBoard(prefs).catch(() => undefined);
    }, DEBOUNCE_MS);

    return () => {
      globalThis.clearTimeout(handle);
    };
  }, [prefs]);

  const updatePrefs = useCallback((patch: Partial<TasksBoardPrefs>) => {
    setPrefs((current) => ({ ...current, ...patch }));
  }, []);

  return { prefs, query, setPrefs, setQuery, updatePrefs };
}
