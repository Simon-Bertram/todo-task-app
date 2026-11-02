import { describe, expect, it } from "vitest";

import {
  AVATAR_GALLERY_PATHS,
  buildAvatarPrompt,
  initialsFromName,
  isAllowedGalleryPath,
  isOwnedAvatarKey,
  pickRandomAvatarPrompt,
} from "./avatars";

describe("avatars helpers", () => {
  it("allowlists gallery paths", () => {
    expect(isAllowedGalleryPath("/avatars/01.svg")).toBe(true);
    expect(isAllowedGalleryPath("/avatars/99.svg")).toBe(false);
    expect(AVATAR_GALLERY_PATHS).toHaveLength(16);
  });

  it("scopes generated keys to the user", () => {
    const key = "user-1/11111111-1111-1111-1111-111111111111.png";
    expect(isOwnedAvatarKey("user-1", key)).toBe(true);
    expect(isOwnedAvatarKey("user-2", key)).toBe(false);
    expect(isOwnedAvatarKey("user-1", "user-1/nope.png")).toBe(false);
  });

  it("builds initials and prompts", () => {
    expect(initialsFromName("Alex Rivera")).toBe("AR");
    expect(initialsFromName("Alex")).toBe("AL");
    expect(buildAvatarPrompt("teal hoodie")).toContain("teal hoodie");
    expect(pickRandomAvatarPrompt(() => 0)).toBeTruthy();
  });
});
