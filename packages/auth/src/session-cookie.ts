/**
 * Better Auth session cookie names (HTTPS uses the __Secure- prefix).
 * Keep both so local http:// and production https:// behave the same.
 */
export const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
] as const;

export interface PreferLastDuplicateCookiesResult {
  cookieHeader: string;
  hadDuplicates: boolean;
}

/**
 * When Cookie has multiple values for a given name, keep only the last
 * occurrence. Browsers often send host-only before Domain= for the same name;
 * better-call's parser keeps the first value only, which shadows the shared
 * Domain=.todo.sarl session after crossSubDomainCookies was enabled.
 */
export function preferLastDuplicateCookies(
  cookieHeader: string | null | undefined,
  names: readonly string[] = SESSION_COOKIE_NAMES
): PreferLastDuplicateCookiesResult | null {
  if (!cookieHeader?.trim()) {
    return null;
  }

  const nameSet = new Set(names);
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const lastIndexByName = new Map<string, number>();
  const pairs: { name: string; raw: string }[] = [];

  for (const part of parts) {
    if (!part) {
      continue;
    }
    const eq = part.indexOf("=");
    const name = eq === -1 ? part : part.slice(0, eq);
    const index = pairs.length;
    pairs.push({ name, raw: part });
    if (nameSet.has(name)) {
      lastIndexByName.set(name, index);
    }
  }

  let hadDuplicates = false;
  const kept: string[] = [];

  for (const [index, pair] of pairs.entries()) {
    if (nameSet.has(pair.name)) {
      const last = lastIndexByName.get(pair.name);
      if (last !== index) {
        hadDuplicates = true;
        continue;
      }
    }
    kept.push(pair.raw);
  }

  if (!hadDuplicates) {
    return { cookieHeader, hadDuplicates: false };
  }

  return { cookieHeader: kept.join("; "), hadDuplicates: true };
}

export function cookieHeaderHasDuplicateSessionTokens(
  cookieHeader: string | null | undefined,
  names: readonly string[] = SESSION_COOKIE_NAMES
): boolean {
  return (
    preferLastDuplicateCookies(cookieHeader, names)?.hadDuplicates ?? false
  );
}

/**
 * Set-Cookie that clears a host-only cookie (omit Domain). Does not clear a
 * Domain=.parent cookie of the same name.
 */
export function hostOnlyExpireSetCookie(name: string): string {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`;
}

/**
 * Append host-only expiry Set-Cookie headers for Better Auth session cookies.
 * Call when sharedCookieDomain is active so leftovers on the API host heal.
 */
export function appendHostOnlySessionCookieExpiry(
  response: Response,
  names: readonly string[] = SESSION_COOKIE_NAMES
): Response {
  const headers = new Headers(response.headers);
  for (const name of names) {
    headers.append("Set-Cookie", hostOnlyExpireSetCookie(name));
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
