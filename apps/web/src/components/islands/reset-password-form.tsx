import type { JSX } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";

import { useAuthForm } from "../../lib/use-auth-form";
import { AuthFormError } from "./auth-form-error";

const INPUT_CLASS =
  "min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-4 text-text-primary placeholder:text-text-muted focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const LABEL_CLASS = "block font-medium text-sm text-text-secondary";

const SUBMIT_CLASS =
  "flex min-h-11 w-full items-center justify-center rounded-sm bg-primary font-semibold text-on-primary text-sm transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const PASSWORD_HINT_ID = "reset-password-hint";

export default function ResetPasswordForm(): JSX.Element {
  const [token, setToken] = useState<string | null>(null);
  const {
    busy,
    clearError,
    error,
    errorId,
    errorRef,
    formProps,
    getFieldProps,
    setBusy,
    showError,
    showMappedError,
  } = useAuthForm({
    errorId: "reset-form-error",
    persistentDescribedBy: {
      password: PASSWORD_HINT_ID,
    },
  });

  useEffect(() => {
    const nextToken = new URLSearchParams(window.location.search).get("token");
    setToken(nextToken);
    if (!nextToken) {
      showMappedError({
        body: "This reset link is invalid or incomplete.",
        code: null,
      });
    }
  }, [showMappedError]);

  const handleSubmit = useCallback(
    async (event: Event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const password = String(data.get("password") ?? "");
      const confirm = String(data.get("confirm") ?? "");

      clearError();

      if (!token) {
        showMappedError({
          body: "This reset link is invalid or incomplete.",
          code: null,
        });
        return;
      }

      if (password !== confirm) {
        showMappedError({
          body: "Passwords do not match.",
          code: null,
        });
        return;
      }

      setBusy(true);

      try {
        const { authClient } = await import("../../lib/auth-client");
        const { error: resetError } = await authClient.resetPassword({
          newPassword: password,
          token,
        });

        if (resetError) {
          showError(resetError);
          return;
        }

        window.location.href = "/#login";
      } catch {
        showError({ message: "An unexpected error occurred." });
      } finally {
        setBusy(false);
      }
    },
    [clearError, setBusy, showError, showMappedError, token]
  );

  const submitDisabled = busy || !token;

  return (
    <div className="w-full max-w-md rounded-md border border-border-contrast bg-surface p-6 sm:p-8">
      <h1
        className="mb-6 font-semibold text-2xl text-text-primary tracking-tight"
        id="reset-heading"
      >
        Choose a new password
      </h1>

      <form
        aria-labelledby="reset-heading"
        className="space-y-4"
        id="reset-form"
        onSubmit={handleSubmit}
        {...formProps}
      >
        <div className="space-y-1.5">
          <label className={LABEL_CLASS} htmlFor="reset-password">
            New password
          </label>
          <input
            autoComplete="new-password"
            className={INPUT_CLASS}
            id="reset-password"
            minLength={12}
            name="password"
            placeholder="••••••••"
            required
            type="password"
            {...getFieldProps("password")}
          />
          <p
            className="font-mono text-text-muted text-xs"
            id={PASSWORD_HINT_ID}
          >
            At least 12 characters
          </p>
        </div>

        <div className="space-y-1.5">
          <label className={LABEL_CLASS} htmlFor="reset-password-confirm">
            Confirm password
          </label>
          <input
            autoComplete="new-password"
            className={INPUT_CLASS}
            id="reset-password-confirm"
            minLength={12}
            name="confirm"
            placeholder="••••••••"
            required
            type="password"
            {...getFieldProps("confirm")}
          />
        </div>

        <AuthFormError error={error} errorId={errorId} errorRef={errorRef} />

        <button
          className={SUBMIT_CLASS}
          disabled={submitDisabled}
          type="submit"
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-text-secondary">
        <a
          className="text-primary underline hover:brightness-110"
          href="/#login"
        >
          Back to sign in
        </a>
      </p>
    </div>
  );
}
