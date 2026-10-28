import {
  D1,
  type InferEnv,
  KV,
  providers,
  Website,
  Worker,
} from "@alchemy.run/cloudflare";
import { Stack } from "alchemy";
import { localState } from "alchemy/State";
import { String as ConfigString, Redacted } from "effect/Config";
import { gen } from "effect/Effect";
import "varlock/auto-load";

const WEB_ORIGIN = "https://todo.sarl";
const API_ORIGIN = "https://api.todo.sarl";

/** Local `alchemy dev` stages are `dev_$USER`; all other stages use custom domains. */
function usesCustomDomains(stage: string): boolean {
  return !stage.startsWith("dev_");
}

export const db = D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
});

export const server = Worker(
  "server",
  Stack.useSync((stack) => {
    const isCustomDomainStage = usesCustomDomains(stack.stage);

    return {
      compatibility: {
        flags: ["nodejs_compat"],
      },
      dev: {
        port: 3000,
      },
      domain: "api.todo.sarl",
      env: {
        BETTER_AUTH_SECRET: Redacted("BETTER_AUTH_SECRET"),
        BETTER_AUTH_URL: isCustomDomainStage ? API_ORIGIN : Worker.URL,
        CORS_ORIGIN: isCustomDomainStage
          ? WEB_ORIGIN
          : ConfigString("CORS_ORIGIN"),
        DB: db,
        EMAIL_FROM: ConfigString("EMAIL_FROM"),
        RESEND_API_KEY: Redacted("RESEND_API_KEY"),
      },
      main: "../../apps/server/src/index.ts",
      name: "todo-server",
      workersDev: false,
    };
  })
);

export type ServerEnv = InferEnv<typeof server>;

/**
 * Web Worker bindings. Declared as a mirror of the Website.Astro `env`
 * below so apps/web can InferEnv-type `cloudflare:workers` without
 * depending on the Stack yield order (PUBLIC_SERVER_URL needs the
 * deployed server URL).
 */
export type WebEnv = InferEnv<{
  PUBLIC_SERVER_URL: string;
  SERVER: typeof server;
  SESSION: ReturnType<typeof KV.Namespace>;
}>;

export default Stack(
  "todo-task-app",
  {
    providers: providers(),
    state: localState(),
  },
  gen(function* () {
    const stack = yield* Stack;
    const isCustomDomainStage = usesCustomDomains(stack.stage);
    const serverWorker = yield* server;
    const webWorker = yield* Website.Astro("web", {
      dev: {
        port: 4321,
      },
      // Apex only here: www→apex redirect reconcile needs Zone Rules
      // permissions that the current API token lacks (Forbidden).
      domain: "todo.sarl",
      env: {
        PUBLIC_SERVER_URL: isCustomDomainStage
          ? API_ORIGIN
          : serverWorker.url.as<string>(),
        SERVER: serverWorker,
        SESSION: KV.Namespace("session"),
      },
      name: "todo-web",
      rootDir: "../../apps/web",
      workersDev: false,
    });

    return {
      server: serverWorker.url,
      web: webWorker.url,
    };
  })
);
