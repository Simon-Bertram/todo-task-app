import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";

import { createAuthedContext } from "../test/fixtures";
import { appRouter } from "./index";

describe("avatars.commit", () => {
  it("saves an allowlisted gallery path", async () => {
    const context = await createAuthedContext("avatar-user");
    const result = await call(
      appRouter.avatars.commit,
      { path: "/avatars/03.svg", source: "gallery" },
      { context }
    );
    expect(result.image).toBe("/avatars/03.svg");
  });

  it("rejects unknown gallery paths", async () => {
    const context = await createAuthedContext("avatar-user-2");
    await expect(
      call(
        appRouter.avatars.commit,
        { path: "/avatars/evil.svg", source: "gallery" },
        { context }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
