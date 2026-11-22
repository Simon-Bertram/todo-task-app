type MarkedModule = typeof import("marked");
type PurifyModule = typeof import("dompurify");

let markedModule: MarkedModule | null = null;
let purifyModule: PurifyModule | null = null;

async function loadMarkdownDeps() {
  if (!(markedModule && purifyModule)) {
    const [marked, purify] = await Promise.all([
      import("marked"),
      import("dompurify"),
    ]);
    markedModule = marked;
    purifyModule = purify;
  }
  return { marked: markedModule, purify: purifyModule };
}

/**
 * Render user notes markdown to sanitized HTML (dynamic import to keep
 * island payloads lean until the detail sheet needs preview).
 */
export async function renderNotesMarkdown(source: string): Promise<string> {
  const trimmed = source.trim();
  if (!trimmed) {
    return "";
  }

  const { marked, purify } = await loadMarkdownDeps();
  marked.setOptions({
    breaks: true,
    gfm: true,
  });
  const raw = await marked.parse(trimmed);
  return purify.default.sanitize(String(raw), {
    USE_PROFILES: { html: true },
  });
}
