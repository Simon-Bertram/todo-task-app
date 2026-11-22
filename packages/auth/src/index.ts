import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@todo-task-app/db";
import {
  account,
  rateLimit,
  session,
  user,
  verification,
} from "@todo-task-app/db/schema/auth";
import { betterAuth } from "better-auth";
import { captcha } from "better-auth/plugins";

import {
  resetPasswordEmailContent,
  sendEmail,
  verificationEmailContent,
} from "./email";

export { CAPTCHA_RESPONSE_HEADER } from "./captcha";

/** Cloudflare always-pass dummy secret — never allow in production. */
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

const CAPTCHA_ENDPOINTS = [
  "/sign-up/email",
  "/sign-in/email",
  "/request-password-reset",
  "/send-verification-email",
] as const;

export interface AuthConfig {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CORS_ORIGIN: string;
  EMAIL_FROM: string;
  NODE_ENV?: string;
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}

export interface CreateAuthOptions {
  desktopOrigins?: readonly string[];
  waitUntil?: (promise: Promise<unknown>) => void;
}

const schema = {
  account,
  rateLimit,
  session,
  user,
  verification,
};

/**
 * Cookie Domain= value must include at least two labels (e.g. `.todo.sarl`),
 * never a bare public suffix like `.sarl`.
 */
function isSafeCookieDomain(domain: string): boolean {
  const withoutLeadingDot = domain.startsWith(".") ? domain.slice(1) : domain;
  return withoutLeadingDot.split(".").filter(Boolean).length >= 2;
}

/**
 * When the API and web app share a parent host (e.g. todo-server.* and
 * todo-web.* under simonbertram.workers.dev, or api.todo.sarl + todo.sarl),
 * return that parent with a leading dot so Better Auth can set Domain= for
 * SSR cookie forwarding. Same-hostname setups (localhost across ports)
 * return undefined.
 *
 * Security: a shared Domain= expands the session-cookie blast radius to every
 * host under that parent. Never deploy untrusted apps on the shared apex
 * (e.g. `.todo.sarl`). Prefer custom domains with workersDev disabled in
 * production so sibling workers.dev hosts do not inherit the cookie.
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

  // Apex + subdomain (e.g. api.todo.sarl + todo.sarl).
  if (authHost.endsWith(`.${webHost}`)) {
    const domain = `.${webHost}`;
    return isSafeCookieDomain(domain) ? domain : undefined;
  }
  if (webHost.endsWith(`.${authHost}`)) {
    const domain = `.${authHost}`;
    return isSafeCookieDomain(domain) ? domain : undefined;
  }

  // Sibling subdomains at equal depth (e.g. api.foo.workers.dev +
  // web.foo.workers.dev → .foo.workers.dev).
  const authParent = authHost.split(".").slice(1).join(".");
  const webParent = webHost.split(".").slice(1).join(".");

  if (!(authParent && authParent === webParent)) {
    return;
  }

  const domain = `.${authParent}`;
  return isSafeCookieDomain(domain) ? domain : undefined;
}

export function createAuth(
  env: AuthConfig,
  database: Database,
  options: CreateAuthOptions = {}
) {
  if (
    env.NODE_ENV === "production" &&
    env.TURNSTILE_SECRET_KEY === TURNSTILE_TEST_SECRET
  ) {
    throw new Error(
      "TURNSTILE_SECRET_KEY must not use the Cloudflare test secret in production"
    );
  }

  const cookieDomain = sharedCookieDomain(env.BETTER_AUTH_URL, env.CORS_ORIGIN);
  const emailConfig = {
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
  };
  const { desktopOrigins = [], waitUntil } = options;

  return betterAuth({
    advanced: {
      backgroundTasks: {
        handler: (promise) => {
          if (waitUntil) {
            waitUntil(promise);
            return;
          }

          promise.catch(() => undefined);
        },
      },
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
      ipAddress: {
        // Only the Cloudflare-owned client IP header — never trust
        // client-controlled X-Forwarded-For for rate-limit keys.
        ipAddressHeaders: ["cf-connecting-ip"],
      },
    },
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: {
      autoSignIn: false,
      disableSignUp: false,
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 12,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user: authUser, url }) => {
        const content = resetPasswordEmailContent(url);
        await sendEmail(emailConfig, {
          subject: "Reset your password",
          to: authUser.email,
          ...content,
        });
      },
    },
    emailVerification: {
      sendOnSignIn: true,
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user: authUser, url }) => {
        const content = verificationEmailContent(url);
        await sendEmail(emailConfig, {
          subject: "Verify your email address",
          to: authUser.email,
          ...content,
        });
      },
    },
    plugins: [
      captcha({
        endpoints: [...CAPTCHA_ENDPOINTS],
        provider: "cloudflare-turnstile",
        secretKey: env.TURNSTILE_SECRET_KEY,
      }),
    ],
    rateLimit: {
      customRules: {
        "/request-password-reset": {
          max: 3,
          window: 60,
        },
        "/reset-password": {
          max: 5,
          window: 60,
        },
        "/send-verification-email": {
          max: 3,
          window: 60,
        },
        "/sign-in/email": {
          max: 5,
          window: 60,
        },
        "/sign-up/email": {
          max: 3,
          window: 60,
        },
      },
      enabled: true,
      storage: "database",
    },
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
    user: {
      additionalFields: {
        celebrations: {
          defaultValue: "subtle",
          input: false,
          required: false,
          type: "string",
        },
        dailyCapacityMinutes: {
          defaultValue: 300,
          input: false,
          required: false,
          type: "number",
        },
        onboardingCompletedAt: {
          input: false,
          required: false,
          type: "date",
        },
        rhythmBest: {
          defaultValue: 0,
          input: false,
          required: false,
          type: "number",
        },
        rhythmCurrent: {
          defaultValue: 0,
          input: false,
          required: false,
          type: "number",
        },
        rhythmOptIn: {
          defaultValue: false,
          input: false,
          required: false,
          type: "boolean",
        },
        taskProgressControl: {
          defaultValue: "pie",
          input: false,
          required: false,
          type: "string",
        },
        tasksBoardPrefs: {
          input: false,
          required: false,
          type: "string",
        },
      },
    },
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
