import type { FastifyInstance, FastifyRequest } from "fastify";
import { REFRESH_COOKIE_NAME, type RefreshTokenPayload } from "./tokens.js";
import { sha256Base64Url } from "../utils/crypto.js";
import type { Storage } from "../storage/storage.js";

export async function getSessionFromRefreshCookie(args: {
  fastify: FastifyInstance;
  request: FastifyRequest;
  storage: Storage;
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

  const session = await args.storage.sessionFindById(payload.sid);
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.refreshJti !== payload.jti) return null;
  if (session.userId !== payload.sub) return null;
  if (session.refreshTokenHash !== sha256Base64Url(token)) return null;

  return { session, payload, token };
}


