import type { JSX } from "preact";
import { useCallback } from "preact/hooks";

import { useAuthForm } from "../../lib/use-auth-form";
import { AuthFormError } from "./auth-form-error";

const INPUT_CLASS =
  "min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-4 text-text-primary placeholder:text-text-muted focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const LABEL_CLASS = "block font-medium text-sm text-text-secondary";

const SUBMIT_CLASS =
  "flex min-h-11 w-full items-center justify-center rounded-sm bg-primary font-semibold text-on-primary text-sm transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const PASSWORD_HINT_ID = "signup-password-hint";

export default function SignUpForm(): JSX.Element {
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
    errorId: "signup-form-error",
    persistentDescribedBy: {
      password: PASSWORD_HINT_ID,
    },
  });

  const handleSubmit = useCallback(
    async (event: Event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const name = String(data.get("name") ?? "");
      const email = String(data.get("email") ?? "");
      const password = String(data.get("password") ?? "");

      clearError();
      setBusy(true);

      try {
        const { authClient } = await import("../../lib/auth-client");
        await authClient.signUp.email(
          {
            callbackURL: `${window.location.origin}/login`,
            email,
            name,
            password,
          },
          {
            onError: (ctx) => {
              showError(ctx.error, { email });
            },
            onSuccess: () => {
              const params = new URLSearchParams({ email });
              window.location.href = `/check-email?${params.toString()}`;
            },
          }
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
        className="mb-6 font-semibold text-2xl text-text-primary tracking-tight"
        id="signup-heading"
      >
        Create account
      </h1>

      <form
        aria-labelledby="signup-heading"
        className="space-y-4"
        id="signup-form"
        onSubmit={handleSubmit}
        {...formProps}
      >
        <div className="space-y-1.5">
          <label className={LABEL_CLASS} htmlFor="signup-name">
            Name
          </label>
          <input
            autoComplete="name"
            className={INPUT_CLASS}
            id="signup-name"
            name="name"
            placeholder="Alex Rivera"
            required
            type="text"
            {...getFieldProps("name")}
          />
        </div>

        <div className="space-y-1.5">
          <label className={LABEL_CLASS} htmlFor="signup-email">
            Email
          </label>
          <input
            autoComplete="email"
            className={INPUT_CLASS}
            id="signup-email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
            {...getFieldProps("email")}
          />
        </div>

        <div className="space-y-1.5">
          <label className={LABEL_CLASS} htmlFor="signup-password">
            Password
          </label>
          <input
            autoComplete="new-password"
            className={INPUT_CLASS}
            id="signup-password"
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

        <AuthFormError
          error={error}
          errorId={errorId}
          errorRef={errorRef}
          variant="inline"
        />

        <button className={SUBMIT_CLASS} disabled={busy} type="submit">
          {busy ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-text-secondary">
        Already have an account?{" "}
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
