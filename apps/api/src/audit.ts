import type { FastifyRequest } from "fastify";
import { prisma } from "./prisma.js";

export async function writeAudit(args: {
  request: FastifyRequest;
  userId?: string | null;
  action: string;
  data?: unknown;
}) {
  const ip = args.request.ip;
  const userAgent = args.request.headers["user-agent"] as string | undefined;
  await prisma.auditLog.create({
    data: {
      userId: args.userId ?? null,
      action: args.action,
      data: args.data as never,
      ip,
      userAgent
    }
  });
}


