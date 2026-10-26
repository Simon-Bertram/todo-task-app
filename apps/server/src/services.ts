import { createAuth as createConfiguredAuth } from "@todo-task-app/auth";
import { type Database, createDb } from "@todo-task-app/db";

import { ENV } from "./env.server";

export function getDb(): Database {
  return createDb(ENV);
}
export async function createAuth(database?: Database) {
  return createConfiguredAuth(ENV, database ?? (await getDb()));
}
