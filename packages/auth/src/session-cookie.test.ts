import { describe, expect, it } from "vitest";

import {
  appendHostOnlySessionCookieExpiry,
  cookieHeaderHasDuplicateSessionTokens,
  hostOnlyExpireSetCookie,
  preferLastDuplicateCookies,
  SESSION_COOKIE_NAMES,
} from "./session-cookie";

describe("preferLastDuplicateCookies", () => {
  it("returns null for missing Cookie header", () => {
    expect(preferLastDuplicateCookies(null)).toBeNull();
    expect(preferLastDuplicateCookies(undefined)).toBeNull();
    expect(preferLastDuplicateCookies("")).toBeNull();
  });

  it("leaves a single session cookie unchanged", () => {
    const cookie = "__Secure-better-auth.session_token=domain-token; other=1";
    expect(preferLastDuplicateCookies(cookie)).toEqual({
      cookieHeader: cookie,
      hadDuplicates: false,
    });
  });

  it("keeps the last session_token when host-only precedes Domain", () => {
    const cookie =
      "__Secure-better-auth.session_token=stale-host; other=1; __Secure-better-auth.session_token=valid-domain";
    expect(preferLastDuplicateCookies(cookie)).toEqual({
      cookieHeader: "other=1; __Secure-better-auth.session_token=valid-domain",
      hadDuplicates: true,
    });
  });

  it("dedupes the non-secure local cookie name", () => {
    const cookie =
      "better-auth.session_token=first; better-auth.session_token=second";
    expect(preferLastDuplicateCookies(cookie)).toEqual({
      cookieHeader: "better-auth.session_token=second",
      hadDuplicates: true,
    });
  });

  it("preserves unrelated duplicate cookie names", () => {
    const cookie = "foo=1; foo=2; __Secure-better-auth.session_token=only";
    expect(preferLastDuplicateCookies(cookie)).toEqual({
      cookieHeader: cookie,
      hadDuplicates: false,
    });
  });
});

describe("cookieHeaderHasDuplicateSessionTokens", () => {
  it("detects duplicates", () => {
    expect(
      cookieHeaderHasDuplicateSessionTokens(
        "__Secure-better-auth.session_token=a; __Secure-better-auth.session_token=b"
      )
    ).toBe(true);
    expect(
      cookieHeaderHasDuplicateSessionTokens(
        "__Secure-better-auth.session_token=only"
      )
    ).toBe(false);
  });
});

describe("hostOnlyExpireSetCookie", () => {
  it("omits Domain so only the host-only jar entry is cleared", () => {
    const header = hostOnlyExpireSetCookie(SESSION_COOKIE_NAMES[0]);
    expect(header).toContain("__Secure-better-auth.session_token=");
    expect(header).toContain("Max-Age=0");
    expect(header).toContain("Path=/");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=None");
    expect(header.toLowerCase()).not.toContain("domain=");
  });
});

describe("appendHostOnlySessionCookieExpiry", () => {
  it("appends Set-Cookie for both session cookie name variants", () => {
    const response = appendHostOnlySessionCookieExpiry(
      new Response("ok", { status: 200 })
    );
    const setCookies = response.headers.getSetCookie();
    expect(setCookies).toHaveLength(SESSION_COOKIE_NAMES.length);
    for (const name of SESSION_COOKIE_NAMES) {
      expect(setCookies.some((value) => value.startsWith(`${name}=`))).toBe(
        true
      );
    }
  });
});
