import type { FastifyRequest } from "fastify";
import { nanoid } from "nanoid";

export async function writeAudit(args: {
  request: FastifyRequest;
  userId?: string | null;
  action: string;
  data?: unknown;
}) {
  const storage = (args.request.server as any).storage;
  const ip = args.request.ip;
  const userAgent = args.request.headers["user-agent"] as string | undefined;
  await storage.auditCreate({
    id: `al_${nanoid(12)}`,
    userId: args.userId ?? null,
    action: args.action,
    data: args.data ?? null,
    ip: ip ?? null,
    userAgent: userAgent ?? null,
    createdAt: new Date()
  });
}


