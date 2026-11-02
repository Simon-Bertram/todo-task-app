const MIN_HIDDEN_MS = 15_000;

let wired = false;
let hiddenAt: number | null = null;

/**
 * Reload board data when the user returns after the tab was hidden
 * for a short while (multi-device optimistic sync without websockets).
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
    if (hiddenAt === null) {
      return;
    }
    const elapsed = Date.now() - hiddenAt;
    hiddenAt = null;
    if (elapsed >= MIN_HIDDEN_MS) {
      location.reload();
    }
  });
}
