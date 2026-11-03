import { ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";

import {
  createRequestId,
  REQUEST_ID_HEADER,
  resolveRequestId,
  serializeOrpcError,
  truncateForReport,
  userMessageForOrpcCode,
  userMessageForUnknownError,
  withRequestIdData,
} from "./app-error";

describe("app-error helpers", () => {
  it("exports the request id header name", () => {
    expect(REQUEST_ID_HEADER).toBe("x-request-id");
  });

  it("creates unique request ids", () => {
    expect(createRequestId()).not.toBe(createRequestId());
  });

  it("prefers an incoming request id", () => {
    expect(resolveRequestId(" abc ", "fallback")).toBe("abc");
    expect(resolveRequestId(null, "fallback")).toBe("fallback");
    expect(resolveRequestId(undefined, undefined).length).toBeGreaterThan(0);
  });

  it("truncates long stacks for reports", () => {
    const long = "x".repeat(5000);
    const truncated = truncateForReport(long, 10);
    expect(truncated).toBe("xxxxxxxxxx…");
    expect(truncateForReport("  ")).toBeUndefined();
  });

  it("serializes ORPCError validation payloads", () => {
    const error = new ORPCError("BAD_REQUEST", {
      data: { issues: [{ message: "Required" }] },
      message: "Input validation failed",
    });
    expect(serializeOrpcError(error)).toMatchObject({
      code: "BAD_REQUEST",
      issues: [{ message: "Required" }],
      message: "Input validation failed",
    });
  });

  it("maps codes to user-facing copy", () => {
    expect(userMessageForOrpcCode("BAD_REQUEST")).toContain(
      "could not be processed"
    );
    expect(userMessageForOrpcCode("INTERNAL_SERVER_ERROR")).toContain(
      "went wrong"
    );
    expect(
      userMessageForUnknownError(
        new ORPCError("BAD_REQUEST", { message: "Input validation failed" })
      )
    ).toContain("could not be processed");
  });

  it("stamps requestId onto ORPCError data once", () => {
    const error = new ORPCError("BAD_REQUEST", {
      data: { issues: [] },
      message: "Input validation failed",
    });
    const stamped = withRequestIdData(error, "req-1");
    expect(stamped.data).toMatchObject({ requestId: "req-1" });
    expect(withRequestIdData(stamped, "req-2").data).toMatchObject({
      requestId: "req-1",
    });
  });
});
