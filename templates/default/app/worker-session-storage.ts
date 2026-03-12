import { createCookieSessionStorage } from "react-router";

/**
 * Session storage for Cloudflare Workers.
 * Uses cookie-based sessions since Workers don't have filesystem access.
 */
export function createWorkerSessionStorage(sessionSecret: string) {
  return createCookieSessionStorage({
    cookie: {
      name: "__session",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secrets: [sessionSecret],
      secure: process.env.NODE_ENV === "production",
    },
  });
}
