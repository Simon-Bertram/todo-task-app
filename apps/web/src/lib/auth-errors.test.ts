import { describe, expect, it } from "vitest";

import { mapAuthClientError } from "./auth-errors";

const INCORRECT_CREDENTIALS = /Incorrect email or password/i;
const IF_ACCOUNT_EXISTS = /if an account exists/i;
const ALREADY_EXISTS = /already exists/i;

describe("mapAuthClientError", () => {
  it("maps EMAIL_NOT_VERIFIED with email CTA", () => {
    const mapped = mapAuthClientError(
      { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
      { email: "user@example.com" }
    );

    expect(mapped.title).toBe("Confirm your email to sign in");
    expect(mapped.body).toContain("user@example.com");
    expect(mapped.action?.href).toBe(
      "/check-email?email=user%40example.com&reason=unverified"
    );
    expect(mapped.action?.label).toBe("Open verification help");
  });

  it("keeps invalid credentials generic", () => {
    const mapped = mapAuthClientError({
      code: "INVALID_EMAIL_OR_PASSWORD",
      message: "Invalid email or password",
    });

    expect(mapped.body).toMatch(INCORRECT_CREDENTIALS);
    expect(mapped.action).toBeUndefined();
  });

  it("softens signup exists without confirming the account", () => {
    const mapped = mapAuthClientError({
      code: "USER_ALREADY_EXISTS",
      message: "User already exists",
    });

    expect(mapped.body).toMatch(IF_ACCOUNT_EXISTS);
    expect(mapped.body).not.toMatch(ALREADY_EXISTS);
    expect(mapped.action?.href).toBe("/#login");
  });

  it("falls back to the provider message", () => {
    const mapped = mapAuthClientError({
      code: "SOME_UNKNOWN_CODE",
      message: "Custom failure",
    });

    expect(mapped.body).toBe("Custom failure");
  });
});
