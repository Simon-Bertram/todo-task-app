import type { JSX } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";

import { authClient } from "../../lib/auth-client";
import { useAuthForm } from "../../lib/use-auth-form";
import { AuthFormError } from "./auth-form-error";

const SUBMIT_CLASS =
  "flex min-h-11 w-full items-center justify-center rounded-sm border border-border-contrast bg-surface-subtle font-semibold text-sm text-text-primary transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

function copyForParams(email: string | null, reason: string | null): string {
  if (email) {
    return reason === "unverified"
      ? `Sign-in is blocked until you verify ${email}. Open the link in your inbox (or resend below), then sign in.`
      : `We sent a verification link to ${email}. Open it to activate your account, then sign in.`;
  }
  if (reason === "unverified") {
    return "Sign-in is blocked until you verify your email. Open the link in your inbox, then sign in.";
  }
  return "We sent a verification link. Open it to activate your account, then sign in.";
}

export default function CheckEmailPanel(): JSX.Element {
  const [email, setEmail] = useState<string | null>(null);
  const [copy, setCopy] = useState(
    "We sent a verification link. Open it to activate your account, then sign in."
  );
  const [canResend, setCanResend] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const {
    busy,
    clearError,
    error,
    errorId,
    errorRef,
    formProps,
    setBusy,
    showError,
  } = useAuthForm({
    errorId: "check-email-error",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextEmail = params.get("email");
    const reason = params.get("reason");
    setEmail(nextEmail);
    setCopy(copyForParams(nextEmail, reason));
    setCanResend(Boolean(nextEmail));
  }, []);

  const handleSubmit = useCallback(
    async (event: Event) => {
      event.preventDefault();
      if (!email) {
        return;
      }

      clearError();
      setSuccess(null);
      setBusy(true);

      try {
        const { error: sendError } = await authClient.sendVerificationEmail({
          callbackURL: `${window.location.origin}/login`,
          email,
        });

        if (sendError) {
          showError(sendError);
          return;
        }

        setSuccess(
          "Verification email sent. Check your inbox and spam folder."
        );
      } catch {
        showError({ message: "An unexpected error occurred." });
      } finally {
        setBusy(false);
      }
    },
    [clearError, email, setBusy, showError]
  );

  return (
    <div className="w-full max-w-md rounded-md border border-border-contrast bg-surface p-6 sm:p-8">
      <h1
        className="mb-2 font-semibold text-2xl text-text-primary tracking-tight"
        id="check-email-heading"
      >
        Check your email
      </h1>
      <p className="mb-6 text-sm text-text-secondary" id="check-email-copy">
        {copy}
      </p>

      <form
        className="space-y-4"
        id="resend-verification-form"
        onSubmit={handleSubmit}
        {...formProps}
      >
        <input name="email" type="hidden" value={email ?? ""} />

        <AuthFormError error={error} errorId={errorId} errorRef={errorRef} />

        <p
          aria-live="polite"
          className={
            success
              ? "text-sm text-text-secondary"
              : "hidden text-sm text-text-secondary"
          }
          id="check-email-success"
          role="status"
        >
          {success}
        </p>

        {canResend ? (
          <button className={SUBMIT_CLASS} disabled={busy} type="submit">
            {busy ? "Sending…" : "Resend verification email"}
          </button>
        ) : null}
      </form>

      <p className="mt-5 text-center text-sm text-text-secondary">
        Ready to continue?{" "}
        <a
          className="text-primary underline hover:brightness-110"
          href="/#login"
        >
          Sign in
        </a>
      </p>
    </div>
  );
}
