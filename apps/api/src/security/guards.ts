import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@lk/shared";
import { prisma } from "../prisma.js";

export async function requireAccessToken(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401);
    throw new Error("Unauthorized");
  }
}

export function requireRole(roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAccessToken(request, reply);
    if (!roles.includes(request.user.role)) {
      reply.code(403);
      throw new Error("Forbidden");
    }
  };
}

export async function requireAdminWithMfa(request: FastifyRequest, reply: FastifyReply) {
  await requireRole(["admin"])(request, reply);
  // Ensure both JWT claim and server-side session agree (defense in depth).
  if (!request.user.mfa) {
    reply.code(403);
    throw new Error("MFA required");
  }
  const session = await prisma.authSession.findUnique({ where: { id: request.user.sid } });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now() || !session.mfaVerified) {
    reply.code(401);
    throw new Error("Session invalid");
  }
}


