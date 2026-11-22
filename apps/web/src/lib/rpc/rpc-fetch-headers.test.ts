import { describe, expect, it } from "vitest";

import { mergeServiceBindingHeaders } from "./rpc-fetch-headers";

describe("mergeServiceBindingHeaders", () => {
  it("preserves Content-Type from a Headers instance (object-spread would drop it)", () => {
    const init = new Headers({
      "content-type": "application/json",
      "x-orpc": "1",
    });

    // Documents the bug: spreading Headers yields an empty object.
    expect({ ...init }).toEqual({});

    const merged = mergeServiceBindingHeaders(init, "session=abc");
    expect(merged.get("content-type")).toBe("application/json");
    expect(merged.get("x-orpc")).toBe("1");
    expect(merged.get("cookie")).toBe("session=abc");
  });

  it("sets cookie over any existing cookie header", () => {
    const merged = mergeServiceBindingHeaders(
      { "content-type": "application/json", cookie: "stale=1" },
      "session=fresh"
    );
    expect(merged.get("cookie")).toBe("session=fresh");
    expect(merged.get("content-type")).toBe("application/json");
  });

  it("omits cookie when empty", () => {
    const merged = mergeServiceBindingHeaders(
      { "content-type": "application/json" },
      ""
    );
    expect(merged.get("cookie")).toBeNull();
    expect(merged.get("content-type")).toBe("application/json");
  });
});
