import type { JSX } from "preact";
import { useCallback, useState } from "preact/hooks";

import { authClient } from "../../lib/auth-client";

export default function LogoutButton(): JSX.Element {
  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(async () => {
    setBusy(true);

    try {
      const { error } = await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.assign("/");
          },
        },
      });
      if (error) {
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  }, []);

  return (
    <button
      aria-busy={busy || undefined}
      className="min-h-11 shrink-0 rounded-sm px-2 font-medium text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
      disabled={busy}
      id="user-card-logout"
      onClick={handleClick}
      type="button"
    >
      Log out
    </button>
  );
}
