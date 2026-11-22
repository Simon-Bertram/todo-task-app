const MIN_HIDDEN_MS = 15_000;

let wired = false;
let hiddenAt: number | null = null;
let blurredAt: number | null = null;

function shouldReload(since: number | null): boolean {
  if (since === null) {
    return false;
  }
  return Date.now() - since >= MIN_HIDDEN_MS;
}

/**
 * Reload board data when the user returns after the tab was hidden
 * or the window lost focus for a short while (multi-device optimistic
 * sync without websockets).
 */
export function revalidateOnFocus(): void {
  if (wired || typeof document === "undefined") {
    return;
  }
  wired = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    if (shouldReload(hiddenAt)) {
      hiddenAt = null;
      location.reload();
      return;
    }
    hiddenAt = null;
  });

  window.addEventListener("blur", () => {
    blurredAt = Date.now();
  });

  window.addEventListener("focus", () => {
    if (shouldReload(blurredAt)) {
      blurredAt = null;
      location.reload();
      return;
    }
    blurredAt = null;
  });
}
