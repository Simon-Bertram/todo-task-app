import type { Session } from "@todo-task-app/auth";
import {
  createTestDb,
  type SeedProjectInput,
  type SeedUserInput,
  seedProject,
  seedUser,
} from "@todo-task-app/db/test";

import type { AvatarsBucket, Context } from "../context";

function createMemoryAvatarsBucket(): AvatarsBucket {
  const store = new Map<string, ArrayBuffer>();
  return {
    get(key) {
      const value = store.get(key);
      if (!value) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        arrayBuffer: () => Promise.resolve(value),
        body: null,
      });
    },
    async put(key, value) {
      if (value instanceof ArrayBuffer) {
        store.set(key, value);
        return;
      }
      if (ArrayBuffer.isView(value)) {
        store.set(
          key,
          value.buffer.slice(
            value.byteOffset,
            value.byteOffset + value.byteLength
          ) as ArrayBuffer
        );
        return;
      }
      if (typeof value === "string") {
        store.set(key, new TextEncoder().encode(value).buffer as ArrayBuffer);
        return;
      }
      if (value instanceof Blob) {
        store.set(key, await value.arrayBuffer());
      }
    },
  };
}

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
      emailVerified: true,
      id: userId,
      name: userId,
      tasksBoardPrefs: null,
      updatedAt: now,
    },
  } as Session;
}

function baseContext(db: Context["db"], session: Context["session"]): Context {
  return {
    assetBaseUrl: "http://localhost:3000",
    avatars: createMemoryAvatarsBucket(),
    db,
    hfToken: "",
    session,
  };
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
  return baseContext(db, createSession(userId, options?.user?.email));
}

export async function createUnauthedContext(): Promise<Context> {
  const db = await createTestDb();
  return baseContext(db, null);
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
    userA: baseContext(db, createSession("user-a")),
    userB: baseContext(db, createSession("user-b")),
  };
}
