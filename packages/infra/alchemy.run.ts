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

export const db = D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
});

export const server = Worker("server", {
  compatibility: {
    flags: ["nodejs_compat"],
  },
  dev: {
    port: 3000,
  },
  env: {
    BETTER_AUTH_SECRET: Redacted("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: Worker.URL,
    CORS_ORIGIN: ConfigString("CORS_ORIGIN"),
    DB: db,
  },
  main: "../../apps/server/src/index.ts",
  name: "todo-server",
});

export type ServerEnv = InferEnv<typeof server>;

export default Stack(
  "todo-task-app",
  {
    providers: providers(),
    state: localState(),
  },
  gen(function* () {
    const serverWorker = yield* server;
    const webWorker = yield* Website.Astro("web", {
      dev: {
        port: 4321,
      },
      env: {
        PUBLIC_SERVER_URL: serverWorker.url.as<string>(),
        SESSION: KV.Namespace("session"),
      },
      name: "todo-web",
      rootDir: "../../apps/web",
    });

    return {
      server: serverWorker.url,
      web: webWorker.url,
    };
  })
);
