import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashPassword } from "../security/password.js";
import { writeAudit } from "../audit.js";

export async function setupRoutes(fastify: FastifyInstance) {
  fastify.post("/bootstrap-admin", async (request, reply) => {
    if (!fastify.config.SETUP_TOKEN) {
      reply.code(404);
      return { error: "NOT_FOUND" };
    }
    const token = (request.headers["x-setup-token"] as string | undefined) ?? "";
    if (token !== fastify.config.SETUP_TOKEN) {
      reply.code(403);
      return { error: "FORBIDDEN" };
    }

    const Body = z.object({
      email: z.string().email(),
      password: z.string().min(10),
      bitrixContactId: z.string().min(1),
      phone: z.string().min(7).max(32).optional()
    });
    const b = Body.parse(request.body);

    const existing = await fastify.storage.userFindByEmail(b.email.toLowerCase());
    if (existing) {
      return { ok: true, userId: existing.id, note: "Already exists" };
    }

    const user = await fastify.storage.userCreate({
      role: "admin",
      email: b.email.toLowerCase(),
      phone: b.phone ?? null,
      passwordHash: await hashPassword(b.password),
      bitrixContactId: b.bitrixContactId,
      allowedDepth: 99,
      isActive: true
    } as any);

    await writeAudit({ request, userId: user.id, action: "setup.bootstrap_admin" });
    return { ok: true, userId: user.id };
  });
}



