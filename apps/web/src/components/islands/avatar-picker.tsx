import { ORPCError } from "@orpc/client";
import {
  AVATAR_GALLERY_PATHS,
  initialsFromName,
  isAllowedGalleryPath,
} from "@todo-task-app/api/lib/avatars";
import { useCallback, useState } from "preact/hooks";
import { orpc } from "../../lib/orpc";
import { showToast } from "../../lib/toast";

const SESSION_EXPIRED_MESSAGE =
  "Session expired. Sign in again, then choose your avatar.";

function avatarActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ORPCError && error.code === "UNAUTHORIZED") {
    return SESSION_EXPIRED_MESSAGE;
  }
  return fallback;
}

type Mode = "choose" | "describe" | "surprise";

interface Props {
  initialImage?: string | null;
  initialName?: string;
  redirectTo?: string;
  variant?: "onboarding" | "settings";
}

function modeButtonClass(active: boolean): string {
  return [
    "min-h-11 flex-1 rounded-sm px-3 font-medium text-sm transition-colors",
    active
      ? "bg-surface-elevated text-text-primary"
      : "text-text-secondary hover:bg-surface hover:text-text-primary",
  ].join(" ");
}

function ModeTabs({
  mode,
  onChoose,
  onDescribe,
  onSurprise,
}: {
  mode: Mode;
  onChoose: () => void;
  onDescribe: () => void;
  onSurprise: () => void;
}) {
  return (
    <div
      aria-label="Avatar source"
      className="flex gap-1 rounded-sm border border-border-contrast bg-surface-subtle p-1"
      role="tablist"
    >
      <button
        aria-selected={mode === "choose"}
        className={modeButtonClass(mode === "choose")}
        onClick={onChoose}
        role="tab"
        type="button"
      >
        Choose
      </button>
      <button
        aria-selected={mode === "describe"}
        className={modeButtonClass(mode === "describe")}
        onClick={onDescribe}
        role="tab"
        type="button"
      >
        Describe
      </button>
      <button
        aria-selected={mode === "surprise"}
        className={modeButtonClass(mode === "surprise")}
        onClick={onSurprise}
        role="tab"
        type="button"
      >
        Surprise me
      </button>
    </div>
  );
}

function GalleryOption({
  onSelect,
  path,
  selected,
}: {
  onSelect: (path: string) => void;
  path: string;
  selected: boolean;
}) {
  const handleClick = useCallback(() => {
    onSelect(path);
  }, [onSelect, path]);

  return (
    <button
      aria-selected={selected}
      className={[
        "flex min-h-11 min-w-11 items-center justify-center rounded-sm border p-1 transition-colors",
        selected
          ? "border-primary bg-surface-elevated"
          : "border-border-contrast hover:border-primary/60",
      ].join(" ")}
      onClick={handleClick}
      role="option"
      type="button"
    >
      <img
        alt=""
        className="size-9 rounded-full object-cover"
        height="36"
        src={path}
        width="36"
      />
    </button>
  );
}

function GalleryGrid({
  onSelect,
  selectedPath,
}: {
  onSelect: (path: string) => void;
  selectedPath: string | null;
}) {
  return (
    <div
      aria-label="Avatar gallery"
      className="grid grid-cols-4 gap-2 sm:grid-cols-8"
      role="listbox"
    >
      {AVATAR_GALLERY_PATHS.map((path) => (
        <GalleryOption
          key={path}
          onSelect={onSelect}
          path={path}
          selected={selectedPath === path}
        />
      ))}
    </div>
  );
}

function AvatarPreview({
  displaySrc,
  initials,
  mode,
  previewKey,
  promptUsed,
  selectedPath,
}: {
  displaySrc: string | null;
  initials: string;
  mode: Mode;
  previewKey: string | null;
  promptUsed: string | null;
  selectedPath: string | null;
}) {
  return (
    <div className="flex items-center gap-4">
      {displaySrc ? (
        <img
          alt=""
          className="size-16 rounded-full border border-border-contrast object-cover"
          height="64"
          src={displaySrc}
          width="64"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-full bg-primary font-semibold text-lg text-on-primary"
        >
          {initials}
        </div>
      )}
      <div className="min-w-0 text-sm text-text-secondary">
        {mode === "choose" && selectedPath
          ? "Gallery selection ready to save."
          : null}
        {previewKey && promptUsed ? (
          <p className="truncate">
            Preview from:{" "}
            <span className="text-text-primary">{promptUsed}</span>
          </p>
        ) : null}
        {selectedPath || previewKey ? null : <p>No avatar selected yet.</p>}
      </div>
    </div>
  );
}

function DescribePanel({
  isGenerating,
  onGenerate,
  onPromptInput,
  prompt,
}: {
  isGenerating: boolean;
  onGenerate: () => void;
  onPromptInput: (event: Event) => void;
  prompt: string;
}) {
  return (
    <div className="space-y-3">
      <label className="block space-y-1.5">
        <span className="font-medium text-sm text-text-secondary">
          Describe your avatar
        </span>
        <textarea
          className="min-h-24 w-full rounded-sm border border-border-contrast bg-surface-subtle px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
          maxLength={240}
          onInput={onPromptInput}
          placeholder="Calm indie hacker with round glasses…"
          value={prompt}
        />
      </label>
      <button
        className="min-h-11 rounded-sm bg-primary px-4 font-semibold text-on-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isGenerating || prompt.trim().length === 0}
        onClick={onGenerate}
        type="button"
      >
        {isGenerating ? "Generating…" : "Generate preview"}
      </button>
    </div>
  );
}

function SurprisePanel({
  isGenerating,
  onGenerate,
}: {
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        We’ll invent a stylized profile from a curated prompt bank.
      </p>
      <button
        className="min-h-11 rounded-sm bg-primary px-4 font-semibold text-on-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isGenerating}
        onClick={onGenerate}
        type="button"
      >
        {isGenerating ? "Generating…" : "Surprise me"}
      </button>
    </div>
  );
}

function ActionBar({
  canRegenerate,
  isGenerating,
  isSaving,
  mode,
  onCommitGenerated,
  onCommitGallery,
  onRegenerate,
  previewKey,
  selectedPath,
}: {
  canRegenerate: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  mode: Mode;
  onCommitGenerated: () => void;
  onCommitGallery: () => void;
  onRegenerate: () => void;
  previewKey: string | null;
  selectedPath: string | null;
}) {
  if (mode === "choose") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          className="min-h-11 rounded-sm bg-primary px-4 font-semibold text-on-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving || !selectedPath}
          onClick={onCommitGallery}
          type="button"
        >
          {isSaving ? "Saving…" : "Use this avatar"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="min-h-11 rounded-sm bg-primary px-4 font-semibold text-on-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSaving || !previewKey}
        onClick={onCommitGenerated}
        type="button"
      >
        {isSaving ? "Saving…" : "Use this avatar"}
      </button>
      <button
        className="min-h-11 rounded-sm border border-border-contrast px-4 text-sm text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isGenerating || isSaving || !canRegenerate}
        onClick={onRegenerate}
        type="button"
      >
        Regenerate
      </button>
    </div>
  );
}

function useAvatarPicker(redirectTo: string, initialImage: string | null) {
  const [mode, setMode] = useState<Mode>("choose");
  const [selectedPath, setSelectedPath] = useState<string | null>(
    initialImage && isAllowedGalleryPath(initialImage) ? initialImage : null
  );
  const [prompt, setPrompt] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialImage && !isAllowedGalleryPath(initialImage) ? initialImage : null
  );
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [promptUsed, setPromptUsed] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearGenerated = useCallback(() => {
    setPreviewKey(null);
    setPromptUsed(null);
  }, []);

  const selectChooseMode = useCallback(() => {
    setMode("choose");
    setError(null);
    clearGenerated();
  }, [clearGenerated]);

  const selectDescribeMode = useCallback(() => {
    setMode("describe");
    setError(null);
    setSelectedPath(null);
  }, []);

  const selectSurpriseMode = useCallback(() => {
    setMode("surprise");
    setError(null);
    setSelectedPath(null);
  }, []);

  const onSelectGallery = useCallback(
    (path: string) => {
      setSelectedPath(path);
      setPreviewUrl(path);
      clearGenerated();
      setError(null);
    },
    [clearGenerated]
  );

  const onPromptInput = useCallback((event: Event) => {
    setPrompt((event.target as HTMLTextAreaElement).value);
  }, []);

  const generate = useCallback(
    async (nextMode: "prompt" | "random") => {
      setIsGenerating(true);
      setError(null);
      setSelectedPath(null);
      try {
        const result = await orpc.avatars.generate(
          nextMode === "random"
            ? { mode: "random" }
            : { mode: "prompt", prompt: prompt.trim() }
        );
        setPreviewUrl(result.previewUrl);
        setPreviewKey(result.key);
        setPromptUsed(result.promptUsed);
        if (nextMode === "random") {
          setPrompt(result.promptUsed);
        }
      } catch (err) {
        const message = avatarActionErrorMessage(
          err,
          "Could not generate avatar. Try again."
        );
        setError(message);
        showToast(message, "error");
      } finally {
        setIsGenerating(false);
      }
    },
    [prompt]
  );

  const onGeneratePrompt = useCallback(() => {
    generate("prompt").catch(() => undefined);
  }, [generate]);

  const onGenerateRandom = useCallback(() => {
    generate("random").catch(() => undefined);
  }, [generate]);

  const onRegenerate = useCallback(() => {
    generate(mode === "describe" ? "prompt" : "random").catch(() => undefined);
  }, [generate, mode]);

  const onCommitGallery = useCallback(() => {
    if (!(selectedPath && isAllowedGalleryPath(selectedPath))) {
      setError("Pick an avatar from the gallery.");
      return;
    }
    setIsSaving(true);
    setError(null);
    orpc.avatars
      .commit({ path: selectedPath, source: "gallery" })
      .then(() => {
        showToast("Avatar saved", "success");
        window.location.assign(redirectTo);
      })
      .catch((err: unknown) => {
        const message = avatarActionErrorMessage(
          err,
          "Could not save avatar. Try again."
        );
        setError(message);
        showToast(message, "error");
        setIsSaving(false);
      });
  }, [redirectTo, selectedPath]);

  const onCommitGenerated = useCallback(() => {
    if (!previewKey) {
      setError("Generate a preview first.");
      return;
    }
    setIsSaving(true);
    setError(null);
    orpc.avatars
      .commit({ key: previewKey, source: "generated" })
      .then(() => {
        showToast("Avatar saved", "success");
        window.location.assign(redirectTo);
      })
      .catch((err: unknown) => {
        const message = avatarActionErrorMessage(
          err,
          "Could not save avatar. Try again."
        );
        setError(message);
        showToast(message, "error");
        setIsSaving(false);
      });
  }, [previewKey, redirectTo]);

  return {
    error,
    isGenerating,
    isSaving,
    mode,
    onCommitGallery,
    onCommitGenerated,
    onGeneratePrompt,
    onGenerateRandom,
    onPromptInput,
    onRegenerate,
    onSelectGallery,
    previewKey,
    previewUrl,
    prompt,
    promptUsed,
    selectChooseMode,
    selectDescribeMode,
    selectedPath,
    selectSurpriseMode,
  };
}

export default function AvatarPicker({
  initialImage = null,
  initialName = "You",
  redirectTo = "/today",
  variant = "settings",
}: Props) {
  const state = useAvatarPicker(redirectTo, initialImage);
  const initials = initialsFromName(initialName);
  const displaySrc = state.selectedPath ?? state.previewUrl;

  return (
    <div className="space-y-5 rounded-md border border-border-contrast bg-surface p-5">
      <div>
        <h2 className="font-semibold text-text-primary">
          {variant === "onboarding" ? "Choose your avatar" : "Profile avatar"}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {variant === "onboarding"
            ? "Pick a gallery face, describe one, or get a surprise. Required before you enter the app."
            : "Update the avatar shown in the sidebar and mobile header."}
        </p>
      </div>

      <ModeTabs
        mode={state.mode}
        onChoose={state.selectChooseMode}
        onDescribe={state.selectDescribeMode}
        onSurprise={state.selectSurpriseMode}
      />

      <AvatarPreview
        displaySrc={displaySrc}
        initials={initials}
        mode={state.mode}
        previewKey={state.previewKey}
        promptUsed={state.promptUsed}
        selectedPath={state.selectedPath}
      />

      {state.mode === "choose" ? (
        <GalleryGrid
          onSelect={state.onSelectGallery}
          selectedPath={state.selectedPath}
        />
      ) : null}

      {state.mode === "describe" ? (
        <DescribePanel
          isGenerating={state.isGenerating}
          onGenerate={state.onGeneratePrompt}
          onPromptInput={state.onPromptInput}
          prompt={state.prompt}
        />
      ) : null}

      {state.mode === "surprise" ? (
        <SurprisePanel
          isGenerating={state.isGenerating}
          onGenerate={state.onGenerateRandom}
        />
      ) : null}

      {state.error ? (
        <p className="text-capacity-over text-sm" role="alert">
          {state.error}
        </p>
      ) : null}

      <ActionBar
        canRegenerate={
          state.mode !== "describe" || state.prompt.trim().length > 0
        }
        isGenerating={state.isGenerating}
        isSaving={state.isSaving}
        mode={state.mode}
        onCommitGallery={state.onCommitGallery}
        onCommitGenerated={state.onCommitGenerated}
        onRegenerate={state.onRegenerate}
        previewKey={state.previewKey}
        selectedPath={state.selectedPath}
      />
    </div>
  );
}
