import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@todo-task-app/db";
import {
  account,
  session,
  user,
  verification,
} from "@todo-task-app/db/schema/auth";
import { betterAuth } from "better-auth";

export interface AuthConfig {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CORS_ORIGIN: string;
}

const schema = {
  account,
  session,
  user,
  verification,
};

export function createAuth(
  env: AuthConfig,
  database: Database,
  desktopOrigins: readonly string[] = []
) {
  return betterAuth({
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "none",
        secure: true,
      },
    },
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: {
      autoSignIn: true,
      disableSignUp: false,
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 12,
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
    },
    plugins: [],
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
    user: {
      additionalFields: {
        dailyCapacityMinutes: {
          defaultValue: 300,
          input: false,
          required: false,
          type: "number",
        },
      },
    },
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
