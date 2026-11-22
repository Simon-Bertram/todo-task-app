import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";

import { ENV } from "../../env.public";
import { loadTurnstile } from "../../lib/turnstile";

export interface TurnstileWidgetProps {
  action: string;
  onExpire: () => void;
  onToken: (token: string) => void;
}

/**
 * Explicit Turnstile render. Script loads from Cloudflare CDN (not the island
 * bundle). Parent remounts via `key` after a spent/failed token.
 */
export function TurnstileWidget({
  action,
  onExpire,
  onToken,
}: TurnstileWidgetProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | null = null;
    const container = containerRef.current;

    if (container === null) {
      return;
    }

    const pending = loadTurnstile()
      .then((turnstile) => {
        if (cancelled || containerRef.current === null) {
          return;
        }

        widgetId = turnstile.render(container, {
          action,
          callback: onToken,
          "error-callback": onExpire,
          "expired-callback": onExpire,
          sitekey: ENV.PUBLIC_TURNSTILE_SITEKEY,
          theme: "dark",
        });
      })
      .catch(() => {
        if (!cancelled) {
          onExpire();
        }
      });

    return () => {
      cancelled = true;
      pending.catch(() => undefined);
      if (widgetId !== null && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [action, onExpire, onToken]);

  return <div className="min-h-[65px]" ref={containerRef} />;
}
