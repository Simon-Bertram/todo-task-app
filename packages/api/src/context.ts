import type { Session } from "@todo-task-app/auth";
import type { Database } from "@todo-task-app/db";

/** Minimal R2 binding surface used by avatar generate/commit. */
export interface AvatarsBucket {
  get: (key: string) => Promise<{
    body: ReadableStream | null;
    arrayBuffer: () => Promise<ArrayBuffer>;
  } | null>;
  put: (
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: { httpMetadata?: { contentType?: string } }
  ) => Promise<unknown>;
}

export interface Context {
  assetBaseUrl: string;
  avatars: AvatarsBucket;
  db: Database;
  hfToken: string;
  session: Session | null;
}
