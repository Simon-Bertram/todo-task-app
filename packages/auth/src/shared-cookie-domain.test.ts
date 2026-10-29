import { describe, expect, it } from "vitest";

import { sharedCookieDomain } from "./index";

describe("sharedCookieDomain", () => {
  it("returns apex domain for API subdomain + apex web", () => {
    expect(
      sharedCookieDomain("https://api.todo.sarl", "https://todo.sarl")
    ).toBe(".todo.sarl");
  });

  it("returns shared parent for API + www siblings", () => {
    expect(
      sharedCookieDomain("https://api.todo.sarl", "https://www.todo.sarl")
    ).toBe(".todo.sarl");
  });

  it("returns shared parent for equal-depth workers.dev hosts", () => {
    expect(
      sharedCookieDomain(
        "https://todo-server.simonbertram.workers.dev",
        "https://todo-web.simonbertram.workers.dev"
      )
    ).toBe(".simonbertram.workers.dev");
  });

  it("returns undefined for identical localhost hosts across ports", () => {
    expect(
      sharedCookieDomain("http://localhost:3000", "http://localhost:4321")
    ).toBeUndefined();
  });

  it("returns undefined for unrelated apex hosts", () => {
    expect(
      sharedCookieDomain("https://todo.sarl", "https://evil.sarl")
    ).toBeUndefined();
  });

  it("returns undefined for invalid URLs", () => {
    expect(
      sharedCookieDomain("not-a-url", "https://todo.sarl")
    ).toBeUndefined();
  });

  it("returns apex domain when web is a subdomain of auth host", () => {
    expect(
      sharedCookieDomain("https://todo.sarl", "https://app.todo.sarl")
    ).toBe(".todo.sarl");
  });
});
