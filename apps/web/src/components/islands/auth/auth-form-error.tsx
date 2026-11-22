import type { JSX, RefObject } from "preact";

import type { MappedAuthError } from "../../lib/auth-errors";

type AuthFormErrorVariant = "inline" | "plain" | "stack";

interface AuthFormErrorProps {
  error: MappedAuthError | null;
  errorId: string;
  errorRef: RefObject<HTMLElement | null>;
  variant?: AuthFormErrorVariant;
}

const ACTION_CLASS = "text-primary underline hover:brightness-110";

/**
 * Accessible mapped-auth error region used by auth form islands.
 */
export function AuthFormError({
  error,
  errorId,
  errorRef,
  variant = "plain",
}: AuthFormErrorProps): JSX.Element {
  const baseClass = error
    ? "text-capacity-over text-sm"
    : "hidden text-capacity-over text-sm";

  if (variant === "stack") {
    return (
      <div
        aria-live="assertive"
        className={`${baseClass} space-y-1`}
        id={errorId}
        ref={errorRef as RefObject<HTMLDivElement>}
        role="alert"
        tabIndex={-1}
      >
        {error?.title ? <p className="font-medium">{error.title}</p> : null}
        {error ? <p>{error.body}</p> : null}
        {error?.action ? (
          <a
            className={`inline-block ${ACTION_CLASS}`}
            href={error.action.href}
          >
            {error.action.label}
          </a>
        ) : null}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <p
        aria-live="assertive"
        className={baseClass}
        id={errorId}
        ref={errorRef as RefObject<HTMLParagraphElement>}
        role="alert"
        tabIndex={-1}
      >
        {error ? (
          <>
            <span>{error.body}</span>
            {error.action ? (
              <>
                {" "}
                <a className={ACTION_CLASS} href={error.action.href}>
                  {error.action.label}
                </a>
              </>
            ) : null}
          </>
        ) : null}
      </p>
    );
  }

  return (
    <p
      aria-live="assertive"
      className={baseClass}
      id={errorId}
      ref={errorRef as RefObject<HTMLParagraphElement>}
      role="alert"
      tabIndex={-1}
    >
      {error?.body ?? null}
    </p>
  );
}
