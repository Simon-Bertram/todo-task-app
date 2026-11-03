import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import {
  mapOrpcErrorMessage,
  referenceIdForError,
  shouldReportOrpcError,
} from "./orpc-errors";

describe("orpc-errors", () => {
  it("maps ORPC codes to safe copy", () => {
    expect(
      mapOrpcErrorMessage(
        new ORPCError("BAD_REQUEST", { message: "Input validation failed" })
      )
    ).toContain("could not be processed");
  });

  it("skips reporting auth and self-report paths", () => {
    expect(
      shouldReportOrpcError(new ORPCError("UNAUTHORIZED"), ["tasks", "list"])
    ).toBe(false);
    expect(shouldReportOrpcError(new Error("boom"), ["errors", "report"])).toBe(
      false
    );
    expect(
      shouldReportOrpcError(new ORPCError("BAD_REQUEST"), ["tasks", "list"])
    ).toBe(true);
  });

  it("reads requestId from error data", () => {
    const error = new ORPCError("BAD_REQUEST", {
      data: { requestId: "req-abc" },
      message: "Input validation failed",
    });
    expect(referenceIdForError(error, "fallback")).toBe("req-abc");
    expect(referenceIdForError(new Error("x"), "fallback")).toBe("fallback");
  });
});
