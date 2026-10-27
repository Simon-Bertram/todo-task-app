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

/**
 * When the API and web app share a parent host (e.g. todo-server.* and
 * todo-web.* under simonbertram.workers.dev), return that parent with a
 * leading dot so Better Auth can set Domain= for SSR cookie forwarding.
 * Same-hostname setups (localhost across ports) return undefined.
 */
export function sharedCookieDomain(
  authUrl: string,
  corsOrigin: string
): string | undefined {
  let authHost: string;
  let webHost: string;
  try {
    authHost = new URL(authUrl).hostname;
    webHost = new URL(corsOrigin).hostname;
  } catch {
    return;
  }

  if (authHost === webHost) {
    return;
  }

  const authParent = authHost.split(".").slice(1).join(".");
  const webParent = webHost.split(".").slice(1).join(".");

  if (!(authParent && authParent === webParent)) {
    return;
  }

  return `.${authParent}`;
}

export function createAuth(
  env: AuthConfig,
  database: Database,
  desktopOrigins: readonly string[] = []
) {
  const cookieDomain = sharedCookieDomain(env.BETTER_AUTH_URL, env.CORS_ORIGIN);

  return betterAuth({
    advanced: {
      ...(cookieDomain
        ? {
            crossSubDomainCookies: {
              domain: cookieDomain,
              enabled: true,
            },
          }
        : {}),
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
