import { useCallback, useEffect, useState } from "preact/hooks";
import { renderNotesMarkdown } from "@/lib/tasks/markdown";

interface Props {
  onInput: (event: Event) => void;
  value: string;
}

/**
 * Markdown notes field: edit as plain text, optional sanitized preview.
 * `marked` / `DOMPurify` load only when Preview is opened.
 */
export default function NotesEditor({ value, onInput }: Props) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "preview") {
      return;
    }
    let cancelled = false;
    setBusy(true);
    renderNotesMarkdown(value)
      .then((next) => {
        if (!cancelled) {
          setHtml(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHtml("<p>Could not render preview.</p>");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, value]);

  const showEdit = useCallback(() => {
    setMode("edit");
  }, []);

  const showPreview = useCallback(() => {
    setMode("preview");
  }, []);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm text-text-secondary">Notes</span>
        <div className="flex gap-1 rounded-full border border-border-subtle bg-surface-subtle p-1">
          <button
            aria-pressed={mode === "edit"}
            className={`min-h-9 rounded-full px-3 font-medium text-xs ${
              mode === "edit"
                ? "bg-surface-elevated text-text-primary"
                : "text-text-secondary"
            }`}
            onClick={showEdit}
            type="button"
          >
            Edit
          </button>
          <button
            aria-pressed={mode === "preview"}
            className={`min-h-9 rounded-full px-3 font-medium text-xs ${
              mode === "preview"
                ? "bg-surface-elevated text-text-primary"
                : "text-text-secondary"
            }`}
            onClick={showPreview}
            type="button"
          >
            Preview
          </button>
        </div>
      </div>
      {mode === "edit" ? (
        <textarea
          className="min-h-24 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
          onInput={onInput}
          placeholder="Optional notes (Markdown supported)"
          value={value}
        />
      ) : (
        <div
          aria-busy={busy}
          className="prose-notes min-h-24 rounded-sm border border-border-contrast bg-surface-subtle px-3 py-2 text-sm text-text-primary"
        >
          <NotesPreviewBody busy={busy} html={html} />
        </div>
      )}
    </div>
  );
}

function NotesPreviewBody({ busy, html }: { busy: boolean; html: string }) {
  if (busy) {
    return <p className="text-text-muted">Rendering…</p>;
  }
  if (html) {
    return (
      <div
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <p className="text-text-muted">No notes yet.</p>;
}
