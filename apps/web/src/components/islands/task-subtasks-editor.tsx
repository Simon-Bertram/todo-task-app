import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { orpc } from "../../lib/orpc";
import type { Subtask } from "../../lib/task-helpers";
import { showToast } from "../../lib/toast";
import { useIsDesktopSm } from "../../lib/use-task-progress-sync";

interface Props {
  onCountsChange: (counts: {
    subtaskCompletedCount: number;
    subtaskCount: number;
  }) => void;
  taskId: string;
}

function isSubtaskReorder(
  data: Record<string | symbol, unknown>
): data is { subtaskId: string; type: "subtask-reorder" } {
  return data.type === "subtask-reorder" && typeof data.subtaskId === "string";
}

function countsFrom(items: Subtask[]) {
  return {
    subtaskCompletedCount: items.filter((item) => item.isCompleted).length,
    subtaskCount: items.length,
  };
}

export default function TaskSubtasksEditor({ taskId, onCountsChange }: Props) {
  const [items, setItems] = useState<Subtask[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const isSm = useIsDesktopSm();
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    orpc.subtasks
      .list({ taskId })
      .then((rows) => {
        if (cancelled) {
          return;
        }
        setItems(rows);
        onCountsChange(countsFrom(rows));
      })
      .catch(() => {
        if (!cancelled) {
          showToast("Could not load subtasks.", "error");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onCountsChange, taskId]);

  const applyItems = useCallback(
    (next: Subtask[]) => {
      setItems(next);
      onCountsChange(countsFrom(next));
    },
    [onCountsChange]
  );

  const onDraftInput = useCallback((event: Event) => {
    setDraft((event.currentTarget as HTMLInputElement).value);
  }, []);

  const onAdd = useCallback(async () => {
    const title = draft.trim();
    if (!title || busy) {
      return;
    }
    setBusy(true);
    try {
      const created = await orpc.subtasks.create({ taskId, title });
      applyItems([...itemsRef.current, created]);
      setDraft("");
    } catch {
      showToast("Could not add subtask. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }, [applyItems, busy, draft, taskId]);

  const onAddClick = useCallback(() => {
    onAdd().catch(() => undefined);
  }, [onAdd]);

  const onAddKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onAdd().catch(() => undefined);
      }
    },
    [onAdd]
  );

  const reorder = useCallback(
    async (activeId: string, targetId: string) => {
      if (activeId === targetId) {
        return;
      }
      const { current } = itemsRef;
      const fromIndex = current.findIndex((item) => item.id === activeId);
      const toIndex = current.findIndex((item) => item.id === targetId);
      if (fromIndex < 0 || toIndex < 0) {
        return;
      }
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) {
        return;
      }
      next.splice(toIndex, 0, moved);
      const withOrder = next.map((item, index) => ({
        ...item,
        sortOrder: index,
      }));
      applyItems(withOrder);
      try {
        await Promise.all(
          withOrder.map((item) =>
            orpc.subtasks.update({ id: item.id, sortOrder: item.sortOrder })
          )
        );
      } catch {
        applyItems(current);
        showToast("Could not reorder subtasks. Try again.", "error");
      }
    },
    [applyItems]
  );

  useEffect(() => {
    if (!isSm) {
      return;
    }
    return monitorForElements({
      onDrop({ location, source }) {
        if (!isSubtaskReorder(source.data)) {
          return;
        }
        const [target] = location.current.dropTargets;
        const targetId =
          target && typeof target.data.subtaskId === "string"
            ? target.data.subtaskId
            : null;
        if (!targetId) {
          return;
        }
        reorder(source.data.subtaskId, targetId).catch(() => undefined);
      },
    });
  }, [isSm, reorder]);

  return (
    <section className="space-y-2 rounded-sm border border-border-contrast bg-surface-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium text-sm text-text-secondary">Subtasks</h4>
        <span className="tabular-metrics font-mono text-text-muted text-xs">
          {items.filter((item) => item.isCompleted).length}/{items.length}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <SubtaskRow
              applyItems={applyItems}
              busy={busy}
              canDrag={isSm}
              item={item}
              items={items}
              key={item.id}
              reorder={reorder}
              setBusy={setBusy}
              showMoveDown={index < items.length - 1}
              showMoveUp={index > 0}
              showUpDown={!isSm}
            />
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          className="min-h-11 min-w-0 flex-1 rounded-sm border border-border-contrast bg-canvas px-3 text-sm text-text-primary focus:border-primary focus:outline-none"
          disabled={busy}
          onInput={onDraftInput}
          onKeyDown={onAddKeyDown}
          placeholder="Add a subtask"
          type="text"
          value={draft}
        />
        <button
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-sm border border-border-contrast px-3 text-sm text-text-primary hover:bg-surface-elevated disabled:opacity-60"
          disabled={busy || draft.trim().length === 0}
          onClick={onAddClick}
          type="button"
        >
          Add
        </button>
      </div>
    </section>
  );
}

function SubtaskRow({
  item,
  items,
  busy,
  canDrag,
  showUpDown,
  showMoveUp,
  showMoveDown,
  applyItems,
  reorder,
  setBusy,
}: {
  applyItems: (next: Subtask[]) => void;
  busy: boolean;
  canDrag: boolean;
  item: Subtask;
  items: Subtask[];
  reorder: (activeId: string, targetId: string) => Promise<void>;
  setBusy: (value: boolean) => void;
  showMoveDown: boolean;
  showMoveUp: boolean;
  showUpDown: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const [dragging, setDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const [title, setTitle] = useState(item.title);

  useEffect(() => {
    setTitle(item.title);
  }, [item.title]);

  useEffect(() => {
    if (!canDrag) {
      return;
    }
    const element = ref.current as HTMLLIElement | null;
    if (!element) {
      return;
    }
    const cleanupDrag = draggable({
      element,
      getInitialData: () => ({
        subtaskId: item.id,
        type: "subtask-reorder",
      }),
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
    const cleanupDrop = dropTargetForElements({
      canDrop: ({ source }) =>
        isSubtaskReorder(source.data) && source.data.subtaskId !== item.id,
      element,
      getData: () => ({ subtaskId: item.id }),
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: () => setIsOver(false),
    });
    return () => {
      cleanupDrag();
      cleanupDrop();
    };
  }, [canDrag, item.id]);

  const onTitleInput = useCallback((event: Event) => {
    setTitle((event.currentTarget as HTMLInputElement).value);
  }, []);

  const onToggle = useCallback(async () => {
    const nextCompleted = !item.isCompleted;
    const previous = items;
    applyItems(
      items.map((row) =>
        row.id === item.id ? { ...row, isCompleted: nextCompleted } : row
      )
    );
    try {
      await orpc.subtasks.update({
        id: item.id,
        isCompleted: nextCompleted,
      });
    } catch {
      applyItems(previous);
      showToast("Could not update subtask. Try again.", "error");
    }
  }, [applyItems, item.id, item.isCompleted, items]);

  const onToggleClick = useCallback(() => {
    onToggle().catch(() => undefined);
  }, [onToggle]);

  const onDelete = useCallback(async () => {
    setBusy(true);
    const previous = items;
    applyItems(items.filter((row) => row.id !== item.id));
    try {
      await orpc.subtasks.delete({ id: item.id });
    } catch {
      applyItems(previous);
      showToast("Could not delete subtask. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }, [applyItems, item.id, items, setBusy]);

  const onDeleteClick = useCallback(() => {
    onDelete().catch(() => undefined);
  }, [onDelete]);

  const onBlur = useCallback(async () => {
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle === item.title) {
      setTitle(item.title);
      return;
    }
    const previous = items;
    applyItems(
      items.map((row) =>
        row.id === item.id ? { ...row, title: nextTitle } : row
      )
    );
    try {
      await orpc.subtasks.update({ id: item.id, title: nextTitle });
    } catch {
      applyItems(previous);
      setTitle(item.title);
      showToast("Could not rename subtask. Try again.", "error");
    }
  }, [applyItems, item.id, item.title, items, title]);

  const onTitleBlur = useCallback(() => {
    onBlur().catch(() => undefined);
  }, [onBlur]);

  const onMoveUp = useCallback(() => {
    const index = items.findIndex((row) => row.id === item.id);
    const target = items[index - 1];
    if (!target) {
      return;
    }
    reorder(item.id, target.id).catch(() => undefined);
  }, [item.id, items, reorder]);

  const onMoveDown = useCallback(() => {
    const index = items.findIndex((row) => row.id === item.id);
    const target = items[index + 1];
    if (!target) {
      return;
    }
    reorder(item.id, target.id).catch(() => undefined);
  }, [item.id, items, reorder]);

  return (
    <li
      className={`flex items-stretch gap-1 rounded-sm border bg-surface px-1 ${
        isOver ? "border-primary" : "border-border-contrast"
      } ${dragging ? "opacity-60" : ""}`}
      ref={ref}
    >
      <button
        aria-label={
          item.isCompleted ? "Mark subtask incomplete" : "Mark subtask complete"
        }
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-text-secondary"
        disabled={busy}
        onClick={onToggleClick}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`flex size-5 items-center justify-center rounded-sm border ${
            item.isCompleted
              ? "border-capacity-ok bg-capacity-ok text-on-primary"
              : "border-border-contrast"
          }`}
        >
          {item.isCompleted ? "✓" : ""}
        </span>
      </button>
      <input
        className={`min-h-11 min-w-0 flex-1 bg-transparent px-1 text-sm focus:outline-none ${
          item.isCompleted
            ? "text-text-muted line-through"
            : "text-text-primary"
        }`}
        disabled={busy}
        onBlur={onTitleBlur}
        onInput={onTitleInput}
        type="text"
        value={title}
      />
      {showUpDown ? (
        <div className="flex shrink-0">
          <button
            aria-label="Move subtask up"
            className="flex min-h-11 min-w-11 items-center justify-center text-text-secondary disabled:opacity-40"
            disabled={busy || !showMoveUp}
            onClick={onMoveUp}
            type="button"
          >
            ↑
          </button>
          <button
            aria-label="Move subtask down"
            className="flex min-h-11 min-w-11 items-center justify-center text-text-secondary disabled:opacity-40"
            disabled={busy || !showMoveDown}
            onClick={onMoveDown}
            type="button"
          >
            ↓
          </button>
        </div>
      ) : null}
      <button
        aria-label="Delete subtask"
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-capacity-over hover:bg-capacity-over/10 disabled:opacity-60"
        disabled={busy}
        onClick={onDeleteClick}
        type="button"
      >
        ×
      </button>
    </li>
  );
}
