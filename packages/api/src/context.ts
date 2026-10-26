import type { Session } from "@todo-task-app/auth";
import type { Database } from "@todo-task-app/db";

export type Context = {
  session: Session | null;
  db: Database;
};
