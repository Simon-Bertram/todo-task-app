// Alchemy validates deployment inputs with Varlock; Workers use native env bindings.
import type { PublicCoercedEnvSchema } from "./env";

const publicServerUrl = import.meta.env.PUBLIC_SERVER_URL;

if (typeof publicServerUrl !== "string") {
  throw new Error("PUBLIC_SERVER_URL is required");
}

export const ENV = {
  PUBLIC_SERVER_URL: publicServerUrl.trim(),
} satisfies Pick<PublicCoercedEnvSchema, "PUBLIC_SERVER_URL">;
