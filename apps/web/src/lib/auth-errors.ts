export interface AuthClientError {
  code?: string | null;
  message?: string | null;
  status?: number | null;
}

export interface AuthErrorAction {
  href: string;
  label: string;
}

export interface MappedAuthError {
  action?: AuthErrorAction;
  body: string;
  code: string | null;
  title?: string;
}

export interface MapAuthClientErrorOptions {
  email?: string;
}

function checkEmailHref(email: string, reason?: "unverified"): string {
  const params = new URLSearchParams({ email });
  if (reason) {
    params.set("reason", reason);
  }
  return `/check-email?${params.toString()}`;
}

/**
 * Maps Better Auth client errors to product copy and optional CTAs.
 * Auth routes keep Better Auth codes; the UI never shows raw `[CODE]` suffixes.
 */
export function mapAuthClientError(
  error: AuthClientError | null | undefined,
  options: MapAuthClientErrorOptions = {}
): MappedAuthError {
  const code = error?.code ?? null;
  const fallback =
    error?.message?.trim() || "Something went wrong. Please try again.";
  const email = options.email?.trim();

  switch (code) {
    case "EMAIL_NOT_VERIFIED": {
      const destination = email
        ? ` A new verification link was sent to ${email}.`
        : " A new verification link was sent to your inbox.";
      return {
        action: email
          ? {
              href: checkEmailHref(email, "unverified"),
              label: "Open verification help",
            }
          : {
              href: "/check-email?reason=unverified",
              label: "Open verification help",
            },
        body: `Confirm your email before signing in.${destination} Check your inbox and spam folder.`,
        code,
        title: "Confirm your email to sign in",
      };
    }
    case "INVALID_EMAIL_OR_PASSWORD":
      return {
        body: "Incorrect email or password. Try again, or reset your password.",
        code,
      };
    case "TOO_MANY_REQUESTS":
      return {
        body: "Too many attempts. Wait a moment, then try again.",
        code,
      };
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return {
        action: {
          href: "/#login",
          label: "Sign in instead",
        },
        body: "An account with this email already exists.",
        code,
      };
    case "PASSWORD_TOO_SHORT":
      return {
        body: "Password must be at least 12 characters.",
        code,
      };
    case "PASSWORD_TOO_LONG":
      return {
        body: "Password is too long. Use 128 characters or fewer.",
        code,
      };
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED":
      return {
        body: "This link is invalid or has expired. Request a new one.",
        code,
      };
    default:
      return {
        body: fallback,
        code,
      };
  }
}
