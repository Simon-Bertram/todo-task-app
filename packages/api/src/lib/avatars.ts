/** Curated static gallery paths (DiceBear loreleiNeutral, CC0). */
export const AVATAR_GALLERY_PATHS = [
  "/avatars/01.svg",
  "/avatars/02.svg",
  "/avatars/03.svg",
  "/avatars/04.svg",
  "/avatars/05.svg",
  "/avatars/06.svg",
  "/avatars/07.svg",
  "/avatars/08.svg",
  "/avatars/09.svg",
  "/avatars/10.svg",
  "/avatars/11.svg",
  "/avatars/12.svg",
  "/avatars/13.svg",
  "/avatars/14.svg",
  "/avatars/15.svg",
  "/avatars/16.svg",
] as const;

export type AvatarGalleryPath = (typeof AVATAR_GALLERY_PATHS)[number];

const GALLERY_SET = new Set<string>(AVATAR_GALLERY_PATHS);
const WHITESPACE = /\s+/g;
const NAME_PARTS = /\s+/;
const OWNED_AVATAR_FILE = /^[0-9a-f-]{36}\.png$/i;

export function isAllowedGalleryPath(path: string): path is AvatarGalleryPath {
  return GALLERY_SET.has(path);
}

/** Prompt ideas for "Surprise me" avatar generation. */
export const AVATAR_PROMPT_BANK = [
  "a calm indie hacker with round glasses and soft teal hoodie",
  "a focused product designer with short curly hair and warm smile",
  "a thoughtful writer with a cozy scarf and gentle eyes",
  "a playful maker with freckles and a bright mustard sweater",
  "a quiet engineer with neat side part and olive jacket",
  "a creative strategist with braided hair and soft lavender tones",
  "a friendly founder with a beanie and curious expression",
  "a zen planner with cropped hair and sage green shirt",
  "a bright researcher with oval glasses and peach cardigan",
  "a determined builder with undercut and navy knit",
  "a warm mentor with silver streaks and soft smile",
  "a curious student with messy bun and sky-blue tee",
] as const;

export function pickRandomAvatarPrompt(
  random = Math.random
): (typeof AVATAR_PROMPT_BANK)[number] {
  const index = Math.floor(random() * AVATAR_PROMPT_BANK.length);
  return AVATAR_PROMPT_BANK[index] ?? AVATAR_PROMPT_BANK[0];
}

export const AVATAR_STYLE_PREFIX =
  "stylized profile avatar portrait, centered face, soft flat illustration, friendly expression, square crop, clean background, no text, no watermark,";

export function buildAvatarPrompt(idea: string): string {
  const cleaned = idea.trim().replace(WHITESPACE, " ").slice(0, 240);
  return `${AVATAR_STYLE_PREFIX} ${cleaned}`;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(NAME_PARTS).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  const firstPart = parts[0] ?? "";
  if (parts.length === 1) {
    return firstPart.slice(0, 2).toUpperCase();
  }
  const first = firstPart[0] ?? "";
  const last = parts.at(-1)?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

/** R2 object keys must be scoped to the user: `{userId}/{uuid}.png`. */
export function isOwnedAvatarKey(userId: string, key: string): boolean {
  if (!(userId && key.startsWith(`${userId}/`))) {
    return false;
  }
  const rest = key.slice(userId.length + 1);
  return OWNED_AVATAR_FILE.test(rest);
}
