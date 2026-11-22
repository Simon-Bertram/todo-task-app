import { CAPTCHA_RESPONSE_HEADER } from "@todo-task-app/auth/captcha";

export { CAPTCHA_RESPONSE_HEADER } from "@todo-task-app/auth/captcha";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const PRECONNECT_HREF = "https://challenges.cloudflare.com";

export interface TurnstileRenderOptions {
  action?: string;
  callback: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  sitekey: string;
  theme?: "auto" | "dark" | "light";
}

export interface TurnstileApi {
  getResponse: (widgetId: string) => string;
  remove: (widgetId: string) => void;
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function ensurePreconnect(): void {
  if (document.querySelector(`link[href="${PRECONNECT_HREF}"]`)) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = PRECONNECT_HREF;
  document.head.appendChild(link);
}

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  ensurePreconnect();

  scriptPromise = new Promise((resolve, reject) => {
    const settle = (): void => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }

      scriptPromise = null;
      reject(new Error("Turnstile failed to load"));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="https://challenges.cloudflare.com/turnstile/"]`
    );

    if (existing) {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }

      existing.addEventListener("load", settle, { once: true });
      existing.addEventListener(
        "error",
        () => {
          scriptPromise = null;
          reject(new Error("Turnstile failed to load"));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", settle, { once: true });
    script.addEventListener(
      "error",
      () => {
        scriptPromise = null;
        reject(new Error("Turnstile failed to load"));
      },
      { once: true }
    );
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function captchaFetchHeaders(
  token: string
): Record<typeof CAPTCHA_RESPONSE_HEADER, string> {
  return {
    [CAPTCHA_RESPONSE_HEADER]: token,
  };
}
