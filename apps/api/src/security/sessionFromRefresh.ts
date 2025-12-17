import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "../prisma.js";
import { REFRESH_COOKIE_NAME, type RefreshTokenPayload } from "./tokens.js";
import { sha256Base64Url } from "../utils/crypto.js";

export async function getSessionFromRefreshCookie(args: {
  fastify: FastifyInstance;
  request: FastifyRequest;
  refreshSecret: string;
}) {
  const token = (args.request.cookies as Record<string, string | undefined>)[REFRESH_COOKIE_NAME];
  if (!token) return null;

  let payload: RefreshTokenPayload;
  try {
    payload = (await args.fastify.jwt.verify(token, { secret: args.refreshSecret })) as RefreshTokenPayload;
  } catch {
    return null;
  }

  const session = await prisma.authSession.findUnique({ where: { id: payload.sid } });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.refreshJti !== payload.jti) return null;
  if (session.userId !== payload.sub) return null;
  if (session.refreshTokenHash !== sha256Base64Url(token)) return null;

  return { session, payload, token };
}


