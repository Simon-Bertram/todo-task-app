import {
  logStructuredError,
  serializeOrpcError,
} from "@todo-task-app/api/lib/app-error";

interface OrpcErrorLogOptions {
  contentType?: string | null;
  path?: readonly string[] | string | null;
  requestId: string;
  userId?: string | null;
}

function headerContentType(
  headers: Headers | Record<string, string | string[] | undefined> | undefined
): string | null {
  if (!headers) {
    return null;
  }
  if (headers instanceof Headers) {
    return headers.get("content-type");
  }
  const value = headers["content-type"] ?? headers["Content-Type"];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export function logOrpcError(
  error: unknown,
  options: OrpcErrorLogOptions & {
    requestHeaders?:
      | Headers
      | Record<string, string | string[] | undefined>
      | undefined;
  }
): void {
  const serialized = serializeOrpcError(error);
  const {
    path: rawPath,
    contentType,
    requestHeaders,
    requestId,
    userId,
  } = options;
  let path: string | null = null;
  if (typeof rawPath === "string") {
    path = rawPath;
  } else if (Array.isArray(rawPath)) {
    path = rawPath.join(".");
  }

  logStructuredError("orpc.error", {
    code: serialized.code,
    contentType: contentType ?? headerContentType(requestHeaders),
    issues: serialized.issues,
    message: serialized.message,
    path,
    requestId,
    userId: userId ?? null,
  });
}
