import { ORPCError } from "@orpc/server";

export const REQUEST_ID_HEADER = "x-request-id";

const MAX_STACK_LENGTH = 4000;

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function resolveRequestId(
  incoming: string | null | undefined,
  fallback?: string
): string {
  const trimmed = incoming?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }
  if (fallback && fallback.trim().length > 0) {
    return fallback.trim();
  }
  return createRequestId();
}

export function truncateForReport(
  value: string | null | undefined,
  max = MAX_STACK_LENGTH
): string | undefined {
  if (!value) {
    return;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return;
  }
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max)}…`;
}

export interface SerializedOrpcError {
  code: string;
  data: unknown;
  issues: unknown;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function serializeOrpcError(error: unknown): SerializedOrpcError {
  if (error instanceof ORPCError) {
    const { code, data, message } = error;
    const issues = isRecord(data) && "issues" in data ? data.issues : undefined;
    return {
      code,
      data: data ?? null,
      issues: issues ?? null,
      message,
    };
  }
  if (error instanceof Error) {
    return {
      code: "UNKNOWN",
      data: null,
      issues: null,
      message: error.message,
    };
  }
  return {
    code: "UNKNOWN",
    data: null,
    issues: null,
    message: "Unknown error",
  };
}

export function requestIdFromError(error: unknown): string | undefined {
  if (!(error instanceof ORPCError)) {
    return;
  }
  if (!isRecord(error.data)) {
    return;
  }
  const value = error.data.requestId;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function userMessageForOrpcCode(code: string): string {
  switch (code) {
    case "UNAUTHORIZED":
      return "Please sign in to continue.";
    case "FORBIDDEN":
      return "You do not have permission to do that.";
    case "NOT_FOUND":
      return "We could not find what you were looking for.";
    case "BAD_REQUEST":
      return "This request could not be processed. Please try again.";
    case "TOO_MANY_REQUESTS":
      return "Too many requests. Please wait a moment and try again.";
    case "PAYLOAD_TOO_LARGE":
      return "That request was too large. Please try something smaller.";
    case "INTERNAL_SERVER_ERROR":
      return "Something went wrong on our side. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function userMessageForUnknownError(error: unknown): string {
  if (error instanceof ORPCError) {
    return userMessageForOrpcCode(error.code);
  }
  return "We couldn’t load this page. Please try again.";
}

export function logStructuredError(
  event: string,
  fields: Record<string, unknown>
): void {
  console.error(
    JSON.stringify({
      event,
      ...fields,
      ts: new Date().toISOString(),
    })
  );
}

export function withRequestIdData(
  error: ORPCError<string, unknown>,
  requestId: string
): ORPCError<string, Record<string, unknown>> {
  const existing = isRecord(error.data) ? error.data : {};
  if (
    typeof existing.requestId === "string" &&
    existing.requestId.trim().length > 0
  ) {
    return new ORPCError(error.code, {
      cause: error,
      data: existing,
      message: error.message,
    });
  }
  return new ORPCError(error.code, {
    cause: error,
    data: { ...existing, requestId },
    message: error.message,
  });
}
