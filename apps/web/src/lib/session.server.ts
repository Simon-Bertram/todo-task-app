/// <reference path="../../cloudflare-env.d.ts" />

import { env } from "cloudflare:workers";

import { ENV } from "../env.public";

const TRAILING_SLASH = /\/$/;

export interface SessionUser {
  email: string;
  id: string;
  image: string | null;
  name: string;
}

interface SessionPayload {
  session?: unknown;
  user?: {
    email?: string;
    id?: string;
    image?: string | null;
    name?: string;
  } | null;
}

export async function loadSessionUser(
  request: Request
): Promise<SessionUser | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const origin = ENV.PUBLIC_SERVER_URL.replace(TRAILING_SLASH, "");
  const url = `${origin}/api/auth/get-session`;

  try {
    const response = await env.SERVER.fetch(url, {
      headers: cookie ? { cookie } : {},
      method: "GET",
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as SessionPayload | null;
    const user = data?.user;
    if (!(user?.id && user.email && user.name)) {
      return null;
    }
    return {
      email: user.email,
      id: user.id,
      image: user.image ?? null,
      name: user.name,
    };
  } catch {
    return null;
  }
}
