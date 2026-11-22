// Alchemy validates deployment inputs with Varlock; Workers use native env bindings.
import type { PublicCoercedEnvSchema } from "./env";

const publicServerUrl = import.meta.env.PUBLIC_SERVER_URL;
const publicTurnstileSitekey = import.meta.env.PUBLIC_TURNSTILE_SITEKEY;

if (typeof publicServerUrl !== "string") {
  throw new Error("PUBLIC_SERVER_URL is required");
}

if (typeof publicTurnstileSitekey !== "string") {
  throw new Error("PUBLIC_TURNSTILE_SITEKEY is required");
}

export const ENV = {
  PUBLIC_SERVER_URL: publicServerUrl.trim(),
  PUBLIC_TURNSTILE_SITEKEY: publicTurnstileSitekey.trim(),
} satisfies Pick<
  PublicCoercedEnvSchema,
  "PUBLIC_SERVER_URL" | "PUBLIC_TURNSTILE_SITEKEY"
>;
