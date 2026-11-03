import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Context } from "../context";
import { createAuthedContext, createUnauthedContext } from "../test/fixtures";
import { errorsRouter } from "./errors";

describe("errorsRouter.report", () => {
  let authed: Context;
  let unauthed: Context;

  beforeEach(async () => {
    authed = await createAuthedContext("user-errors");
    unauthed = await createUnauthedContext();
  });

  it("rejects unauthenticated reports", async () => {
    await expect(
      call(
        errorsRouter.report,
        { message: "boom", source: "island" },
        { context: unauthed }
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("accepts a report and returns a request id", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await call(
      errorsRouter.report,
      {
        code: "BAD_REQUEST",
        message: "Input validation failed",
        path: "tasks.listCompleted",
        requestId: "client-req-1",
        source: "island",
        url: "https://todo.example/complete",
      },
      { context: authed }
    );
    expect(result).toEqual({ ok: true, requestId: "client-req-1" });
    expect(spy).toHaveBeenCalled();
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      event: "client.error.report",
      path: "tasks.listCompleted",
      requestId: "client-req-1",
      userId: "user-errors",
    });
    spy.mockRestore();
  });

  it("rejects empty messages", async () => {
    await expect(
      call(
        errorsRouter.report,
        { message: "   ", source: "window" },
        { context: authed }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
