import type { Session } from "@todo-task-app/auth";
import {
  createTestDb,
  type SeedProjectInput,
  type SeedUserInput,
  seedProject,
  seedUser,
} from "@todo-task-app/db/test";

import type { Context } from "../context";

export function createSession(userId: string, email?: string): Session {
  const now = new Date();
  return {
    session: {
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      id: `session-${userId}`,
      token: `token-${userId}`,
      updatedAt: now,
      userId,
    },
    user: {
      createdAt: now,
      dailyCapacityMinutes: 300,
      email: email ?? `${userId}@example.com`,
      emailVerified: false,
      id: userId,
      name: userId,
      updatedAt: now,
    },
  } as Session;
}

export async function createAuthedContext(
  userId: string,
  options?: {
    project?: Omit<SeedProjectInput, "userId">;
    user?: Omit<SeedUserInput, "id">;
  }
): Promise<Context> {
  const db = await createTestDb();
  await seedUser(db, {
    id: userId,
    ...options?.user,
  });
  if (options?.project) {
    await seedProject(db, {
      ...options.project,
      userId,
    });
  }
  return {
    db,
    session: createSession(userId, options?.user?.email),
  };
}

export async function createUnauthedContext(): Promise<Context> {
  const db = await createTestDb();
  return {
    db,
    session: null,
  };
}

export async function createTwoUserContext(): Promise<{
  db: Context["db"];
  userA: Context;
  userB: Context;
}> {
  const db = await createTestDb();
  await seedUser(db, { id: "user-a" });
  await seedUser(db, { id: "user-b" });
  return {
    db,
    userA: {
      db,
      session: createSession("user-a"),
    },
    userB: {
      db,
      session: createSession("user-b"),
    },
  };
}
