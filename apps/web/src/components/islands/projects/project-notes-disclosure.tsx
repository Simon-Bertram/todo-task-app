import { useCallback, useEffect, useState } from "preact/hooks";
import { orpc } from "../../lib/orpc";

interface PersistProps {
  label?: string;
  mode?: "persist";
  notes: string | null;
  onSaved?: (notes: string | null) => void;
  projectId: string;
}

interface DraftProps {
  label?: string;
  mode: "draft";
  onChange: (value: string) => void;
  value: string;
}

type Props = PersistProps | DraftProps;

function hasNotesContent(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export default function ProjectNotesDisclosure(props: Props) {
  const label = props.label ?? "Project notes";
  const isDraft = props.mode === "draft";
  const projectId = isDraft ? null : props.projectId;
  const onSaved = isDraft ? undefined : props.onSaved;
  const onDraftChange = isDraft ? props.onChange : undefined;
  const sourceNotes = isDraft ? props.value : (props.notes ?? "");
  const hintNotes = isDraft ? props.value : props.notes;

  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(sourceNotes);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(sourceNotes);
    setIsOpen(false);
    setError(null);
  }, [sourceNotes]);

  const onToggle = useCallback(() => {
    setIsOpen((open) => !open);
    setError(null);
  }, []);

  const onInput = useCallback(
    (event: Event) => {
      const { value } = event.currentTarget as HTMLTextAreaElement;
      setDraft(value);
      onDraftChange?.(value);
    },
    [onDraftChange]
  );

  const onSave = useCallback(async () => {
    if (isDraft || isBusy || !projectId) {
      return;
    }
    const nextNotes = draft.trim() ? draft.trim() : null;
    setIsBusy(true);
    setError(null);
    try {
      await orpc.projects.update({
        id: projectId,
        notes: nextNotes,
      });
      onSaved?.(nextNotes);
    } catch {
      setError("Could not save project notes. Try again.");
    } finally {
      setIsBusy(false);
    }
  }, [draft, isBusy, isDraft, onSaved, projectId]);

  const toggleLabel = hasNotesContent(hintNotes) ? `${label} · added` : label;

  return (
    <div className="space-y-2">
      <button
        aria-expanded={isOpen}
        className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border border-border-contrast px-3 text-left text-sm text-text-secondary hover:bg-surface-elevated"
        onClick={onToggle}
        type="button"
      >
        <span>{toggleLabel}</span>
        <span aria-hidden="true" className="text-text-muted">
          {isOpen ? "▾" : "▸"}
        </span>
      </button>

      {isOpen ? (
        <div className="space-y-2">
          <label className="block space-y-1.5">
            <span className="sr-only">{label}</span>
            <textarea
              className="min-h-24 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              onInput={onInput}
              placeholder="Optional project notes…"
              value={isDraft ? props.value : draft}
            />
          </label>
          {error ? (
            <p className="text-capacity-over text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {isDraft ? null : (
            <button
              className="inline-flex min-h-11 items-center rounded-sm bg-primary px-3 font-semibold text-on-primary text-sm disabled:opacity-60"
              disabled={isBusy}
              onClick={onSave}
              type="button"
            >
              {isBusy ? "Saving…" : "Save notes"}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
