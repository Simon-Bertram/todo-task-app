import type { JSX } from "preact";
import { useCallback, useState } from "preact/hooks";

import { useAuthForm } from "../../lib/use-auth-form";
import { AuthFormError } from "./auth-form-error";

const INPUT_CLASS =
  "min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-4 text-text-primary placeholder:text-text-muted focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const LABEL_CLASS = "block font-medium text-sm text-text-secondary";

const SUBMIT_CLASS =
  "flex min-h-11 w-full items-center justify-center rounded-sm bg-primary font-semibold text-on-primary text-sm transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export default function ForgotPasswordForm(): JSX.Element {
  const [success, setSuccess] = useState<string | null>(null);
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
  } = useAuthForm({
    errorId: "forgot-form-error",
  });

  const handleSubmit = useCallback(
    async (event: Event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const email = String(data.get("email") ?? "");

      clearError();
      setSuccess(null);
      setBusy(true);

      try {
        const { authClient } = await import("../../lib/auth-client");
        const { error: requestError } = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (requestError) {
          showError(requestError);
          return;
        }

        setSuccess(
          "If this email exists in our system, check your inbox for a reset link."
        );
      } catch {
        showError({ message: "An unexpected error occurred." });
      } finally {
        setBusy(false);
      }
    },
    [clearError, setBusy, showError]
  );

  return (
    <div className="w-full max-w-md rounded-md border border-border-contrast bg-surface p-6 sm:p-8">
      <h1
        className="mb-2 font-semibold text-2xl text-text-primary tracking-tight"
        id="forgot-heading"
      >
        Reset password
      </h1>
      <p className="mb-6 text-sm text-text-secondary">
        Enter your email and we will send a reset link if an account exists.
      </p>

      <form
        aria-labelledby="forgot-heading"
        className="space-y-4"
        id="forgot-form"
        onSubmit={handleSubmit}
        {...formProps}
      >
        <div className="space-y-1.5">
          <label className={LABEL_CLASS} htmlFor="forgot-email">
            Email
          </label>
          <input
            autoComplete="email"
            className={INPUT_CLASS}
            id="forgot-email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
            {...getFieldProps("email")}
          />
        </div>

        <AuthFormError error={error} errorId={errorId} errorRef={errorRef} />

        <p
          aria-live="polite"
          className={
            success
              ? "text-sm text-text-secondary"
              : "hidden text-sm text-text-secondary"
          }
          id="forgot-form-success"
          role="status"
        >
          {success}
        </p>

        <button className={SUBMIT_CLASS} disabled={busy} type="submit">
          {busy ? "Sending…" : "Send reset link"}
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
