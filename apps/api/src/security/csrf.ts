import type { FastifyReply, FastifyRequest } from "fastify";
import { randomToken, timingSafeEqual } from "../utils/crypto.js";

export const CSRF_COOKIE_NAME = "csrfToken";
export const CSRF_HEADER_NAME = "x-csrf-token";

export function issueCsrfToken(reply: FastifyReply, opts: { secure: boolean; sameSite: "strict" | "lax" | "none" }) {
  const token = randomToken(24);
  reply.setCookie(CSRF_COOKIE_NAME, token, {
    path: "/",
    httpOnly: false,
    secure: opts.secure,
    sameSite: opts.sameSite
  });
  return token;
}

export function requireCsrf(request: FastifyRequest, reply: FastifyReply) {
  const cookieToken = (request.cookies as Record<string, string | undefined>)[CSRF_COOKIE_NAME];
  const headerToken = (request.headers[CSRF_HEADER_NAME] as string | undefined) ?? undefined;
  if (!cookieToken || !headerToken || !timingSafeEqual(cookieToken, headerToken)) {
    reply.code(403);
    throw new Error("CSRF validation failed");
  }
}



