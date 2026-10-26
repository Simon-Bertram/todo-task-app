import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouterClient } from "@todo-task-app/api/routers/index";

import { ENV } from "../env.public";

export const link = new RPCLink({
  fetch(url, options) {
    return globalThis.fetch(url, {
      ...options,
      credentials: "include",
    });
  },
  origin: ENV.PUBLIC_SERVER_URL.replace(/\/$/, ""),
  url: "/rpc",
});

export const orpc: AppRouterClient = createORPCClient(link);
