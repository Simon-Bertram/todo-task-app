import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { describe, expect, it } from "vitest";

import { createAuthedContext } from "../test/fixtures";
import { tasksRouter } from "./tasks";

interface ListCompletedClient {
  tasks: {
    listCompleted: (input: {
      range: "this_week" | "last_week" | "last_month" | "last_year" | "all";
      timeZone: string;
    }) => Promise<unknown[]>;
  };
}

function createTestClient(
  context: Awaited<ReturnType<typeof createAuthedContext>>,
  mergeHeaders: (
    initHeaders: HeadersInit | undefined,
    cookie: string
  ) => HeadersInit
) {
  const handler = new RPCHandler({ tasks: tasksRouter });
  const cookie = "session=test";

  const link = new RPCLink({
    fetch: async (requestUrl, init) => {
      const request = new Request(requestUrl, {
        ...init,
        headers: mergeHeaders(init?.headers, cookie),
      });
      const result = await handler.handle(request, {
        context,
        prefix: "/rpc",
      });
      if (!(result.matched && result.response)) {
        return new Response("not matched", { status: 404 });
      }
      return result.response;
    },
    origin: "http://localhost",
    url: "/rpc",
  });

  return createORPCClient(link) as ListCompletedClient;
}

describe("listCompleted over RPCLink header merge", () => {
  it("fails input validation when Headers are object-spread (production bug)", async () => {
    const context = await createAuthedContext("rpc-broken");
    const client = createTestClient(context, (initHeaders, cookie) => ({
      ...initHeaders,
      cookie,
    }));

    await expect(
      client.tasks.listCompleted({ range: "this_week", timeZone: "UTC" })
    ).rejects.toMatchObject({
      message: "Input validation failed",
    });
  });

  it("succeeds when Headers are preserved via new Headers()", async () => {
    const context = await createAuthedContext("rpc-fixed");
    const client = createTestClient(context, (initHeaders, cookie) => {
      const headers = new Headers(initHeaders);
      if (cookie) {
        headers.set("cookie", cookie);
      }
      return headers;
    });

    await expect(
      client.tasks.listCompleted({ range: "this_week", timeZone: "UTC" })
    ).resolves.toEqual([]);
  });
});
