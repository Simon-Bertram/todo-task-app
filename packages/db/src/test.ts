import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import type { Database } from "./index";
import { relations } from "./relations";
import { user } from "./schema/auth";
import { projects } from "./schema/projects";

const migrationsRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations"
);

const STATEMENT_BREAKPOINT = /-->\s*statement-breakpoint\s*/;

function loadMigrationStatements(): string[] {
  const folders = readdirSync(migrationsRoot)
    .filter((name) => !name.startsWith("."))
    .sort();

  const statements: string[] = [];
  for (const folder of folders) {
    const sql = readFileSync(
      join(migrationsRoot, folder, "migration.sql"),
      "utf8"
    );
    for (const part of sql.split(STATEMENT_BREAKPOINT)) {
      const statement = part.trim();
      if (statement.length > 0) {
        statements.push(statement);
      }
    }
  }
  return statements;
}

export async function createTestDb(): Promise<Database> {
  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys = ON");

  // Migrations must run in order; later statements depend on earlier tables.
  const statements = loadMigrationStatements();
  for (const statement of statements) {
    // biome-ignore lint/performance/noAwaitInLoops: sequential DDL required
    await client.execute(statement);
  }

  const db = drizzle({ client, relations });
  return db as unknown as Database;
}

export interface SeedUserInput {
  email?: string;
  id: string;
  name?: string;
}

export async function seedUser(
  db: Database,
  input: SeedUserInput
): Promise<void> {
  await db.insert(user).values({
    email: input.email ?? `${input.id}@example.com`,
    id: input.id,
    name: input.name ?? input.id,
  });
}

export interface SeedProjectInput {
  color?: string;
  id: string;
  name?: string;
  userId: string;
}

export async function seedProject(
  db: Database,
  input: SeedProjectInput
): Promise<void> {
  await db.insert(projects).values({
    color: input.color ?? "#3b82f6",
    id: input.id,
    name: input.name ?? "Project",
    userId: input.userId,
  });
}
