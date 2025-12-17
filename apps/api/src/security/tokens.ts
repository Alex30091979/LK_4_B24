import type { FastifyInstance, FastifyReply } from "fastify";
import { randomToken, sha256Base64Url } from "../utils/crypto.js";
import type { Role } from "@lk/shared";
import type { Storage } from "../storage/storage.js";

export type AccessTokenPayload = {
  sub: string; // userId
  role: Role;
  sid: string; // sessionId
  mfa: boolean;
};

export type RefreshTokenPayload = {
  sub: string;
  sid: string;
  jti: string;
};

export const REFRESH_COOKIE_NAME = "refreshToken";

export async function createSessionAndTokens(args: {
  fastify: FastifyInstance;
  reply: FastifyReply;
  storage: Storage;
  userId: string;
  role: Role;
  mfaVerified: boolean;
  ip?: string;
  userAgent?: string;
  refreshTtlSeconds: number;
  accessTtlSeconds: number;
  cookieSecure: boolean;
  cookieSameSite: "strict" | "lax" | "none";
  refreshSecret: string;
}) {
  const sessionId = randomToken(18);
  const refreshJti = randomToken(18);

  const refreshJwt = await args.fastify.jwt.sign(
    { sub: args.userId, sid: sessionId, jti: refreshJti } satisfies RefreshTokenPayload,
    { expiresIn: args.refreshTtlSeconds, secret: args.refreshSecret }
  );
  const refreshHash = sha256Base64Url(refreshJwt);

  const expiresAt = new Date(Date.now() + args.refreshTtlSeconds * 1000);
  await args.storage.sessionCreate({
    id: sessionId,
    userId: args.userId,
    refreshTokenHash: refreshHash,
    refreshJti,
    mfaVerified: args.mfaVerified,
    createdAt: new Date(),
    lastUsedAt: new Date(),
    expiresAt,
    revokedAt: null,
    ip: args.ip ?? null,
    userAgent: args.userAgent ?? null
  });

  // Refresh cookie is HttpOnly. Access token is returned in body for API-first (mobile-ready).
  args.reply.setCookie(REFRESH_COOKIE_NAME, refreshJwt, {
    path: "/auth",
    httpOnly: true,
    secure: args.cookieSecure,
    sameSite: args.cookieSameSite
  });

  const accessJwt = await args.fastify.jwt.sign(
    { sub: args.userId, role: args.role, sid: sessionId, mfa: args.mfaVerified } satisfies AccessTokenPayload,
    { expiresIn: args.accessTtlSeconds }
  );

  return { accessToken: accessJwt, sessionId };
}

export async function rotateRefreshToken(args: {
  fastify: FastifyInstance;
  reply: FastifyReply;
  storage: Storage;
  sessionId: string;
  userId: string;
  role: Role;
  mfaVerified: boolean;
  refreshTtlSeconds: number;
  accessTtlSeconds: number;
  cookieSecure: boolean;
  cookieSameSite: "strict" | "lax" | "none";
  refreshSecret: string;
}) {
  const refreshJti = randomToken(18);
  const refreshJwt = await args.fastify.jwt.sign(
    { sub: args.userId, sid: args.sessionId, jti: refreshJti } satisfies RefreshTokenPayload,
    { expiresIn: args.refreshTtlSeconds, secret: args.refreshSecret }
  );
  const refreshHash = sha256Base64Url(refreshJwt);

  const expiresAt = new Date(Date.now() + args.refreshTtlSeconds * 1000);
  await args.storage.sessionUpdate(args.sessionId, {
    refreshJti,
    refreshTokenHash: refreshHash,
    expiresAt,
    lastUsedAt: new Date()
  });

  args.reply.setCookie(REFRESH_COOKIE_NAME, refreshJwt, {
    path: "/auth",
    httpOnly: true,
    secure: args.cookieSecure,
    sameSite: args.cookieSameSite
  });

  const accessJwt = await args.fastify.jwt.sign(
    { sub: args.userId, role: args.role, sid: args.sessionId, mfa: args.mfaVerified } satisfies AccessTokenPayload,
    { expiresIn: args.accessTtlSeconds }
  );

  return { accessToken: accessJwt };
}


