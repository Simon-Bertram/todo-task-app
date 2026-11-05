import type { JSX } from "preact";
import { useCallback } from "preact/hooks";

import { authClient } from "../../lib/auth-client";
import { useAuthForm } from "../../lib/use-auth-form";
import { AuthFormError } from "./auth-form-error";

const INPUT_CLASS =
  "min-h-11 w-full rounded-sm border border-border-contrast bg-surface-subtle px-4 text-text-primary placeholder:text-text-muted focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const LABEL_CLASS = "block font-medium text-sm text-text-secondary";

const SUBMIT_CLASS =
  "flex min-h-11 w-full items-center justify-center rounded-sm bg-primary font-semibold text-on-primary text-sm transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export interface SignInFormProps {
  heading?: string;
  headingLevel?: 1 | 2;
  showHeading?: boolean;
  variant?: "glass" | "solid";
}

export default function SignInForm({
  heading = "Welcome back",
  headingLevel = 1,
  showHeading = true,
  variant = "solid",
}: SignInFormProps): JSX.Element {
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
    errorId: "signin-form-error",
  });

  const shellClass =
    variant === "glass"
      ? "glass-panel w-full max-w-md rounded-md p-6 sm:p-8"
      : "w-full max-w-md rounded-md border border-border-contrast bg-surface p-6 sm:p-8";

  const headingClass = showHeading
    ? "mb-6 font-semibold text-2xl text-text-primary tracking-tight"
    : "sr-only";

  const HeadingTag = headingLevel === 2 ? "h2" : "h1";

  const handleSubmit = useCallback(
    async (event: Event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const email = String(data.get("email") ?? "");
      const password = String(data.get("password") ?? "");

      clearError();
      setBusy(true);

      try {
        await authClient.signIn.email(
          {
            email,
            password,
          },
          {
            onError: (ctx) => {
              showError(ctx.error, { email });
            },
            onSuccess: () => {
              window.location.href = "/today";
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
    <div className={shellClass} id="login">
      <HeadingTag className={headingClass} id="signin-heading">
        {heading}
      </HeadingTag>

      <form
        aria-labelledby="signin-heading"
        className="space-y-4"
        id="signin-form"
        onSubmit={handleSubmit}
        {...formProps}
      >
        <div className="space-y-1.5">
          <label className={LABEL_CLASS} htmlFor="signin-email">
            Email
          </label>
          <input
            autoComplete="email"
            className={INPUT_CLASS}
            id="signin-email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
            {...getFieldProps("email")}
          />
        </div>

        <div className="space-y-1.5">
          <label className={LABEL_CLASS} htmlFor="signin-password">
            Password
          </label>
          <input
            autoComplete="current-password"
            className={INPUT_CLASS}
            id="signin-password"
            name="password"
            placeholder="••••••••"
            required
            type="password"
            {...getFieldProps("password")}
          />
        </div>

        <AuthFormError
          error={error}
          errorId={errorId}
          errorRef={errorRef}
          variant="stack"
        />

        <div className="flex justify-end">
          <a
            className="text-primary text-sm underline hover:brightness-110"
            href="/forgot-password"
          >
            Forgot password?
          </a>
        </div>

        <button className={SUBMIT_CLASS} disabled={busy} type="submit">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-text-secondary">
        Need an account?{" "}
        <a
          className="text-primary underline hover:brightness-110"
          href="/signup"
        >
          Sign up
        </a>
      </p>
    </div>
  );
}
