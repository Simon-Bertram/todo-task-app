import { createAuth as createConfiguredAuth } from "@todo-task-app/auth";
import type { Database } from "@todo-task-app/db";
import { createDb } from "@todo-task-app/db";

import { ENV } from "./env.server";

export function getDb(): Database {
  return createDb(ENV);
}

export function createAuth(
  database?: Database,
  waitUntil?: (promise: Promise<unknown>) => void
) {
  return createConfiguredAuth(ENV, database ?? getDb(), { waitUntil });
}
