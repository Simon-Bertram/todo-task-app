import { ORPCError } from "@orpc/client";
import {
  requestIdFromError,
  userMessageForUnknownError,
} from "@todo-task-app/api/lib/app-error";

const SKIP_REPORT_CODES = new Set(["UNAUTHORIZED", "FORBIDDEN"]);

export function mapOrpcErrorMessage(error: unknown): string {
  return userMessageForUnknownError(error);
}

export function mapOrpcErrorCode(error: unknown): string | undefined {
  if (error instanceof ORPCError) {
    return error.code;
  }
}

export function shouldReportOrpcError(
  error: unknown,
  path?: readonly string[]
): boolean {
  if (path && path[0] === "errors" && path[1] === "report") {
    return false;
  }
  if (!(error instanceof ORPCError)) {
    return true;
  }
  return !SKIP_REPORT_CODES.has(error.code);
}

export function referenceIdForError(
  error: unknown,
  fallback?: string
): string | undefined {
  return requestIdFromError(error) ?? fallback;
}
