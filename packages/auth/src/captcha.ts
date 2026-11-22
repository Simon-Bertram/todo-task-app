/**
 * Better Auth captcha plugin header — client must send the Turnstile token
 * with this name; Hono CORS allowHeaders on the API Worker must allow it.
 */
export const CAPTCHA_RESPONSE_HEADER = "x-captcha-response" as const;
