import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAdminWithMfa } from "../security/guards.js";
import { hashPassword } from "../security/password.js";
import { writeAudit } from "../audit.js";

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.post("/sync/bitrix", { preHandler: requireAdminWithMfa }, async (request, reply) => {
    try {
      const result = await fastify.bitrixSync.syncPartial();
      await writeAudit({ request, userId: request.user.sub, action: "admin.bitrix.sync", data: result });
      return { ok: true, result };
    } catch (e: any) {
      await writeAudit({
        request,
        userId: request.user.sub,
        action: "admin.bitrix.sync_failed",
        data: { message: e?.message ?? "error" }
      });
      reply.code(501);
      return { error: "NOT_IMPLEMENTED", message: e?.message ?? "Not implemented" };
    }
  });

  fastify.get("/users", { preHandler: requireAdminWithMfa }, async (request) => {
    const Query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20)
    });
    const q = Query.parse(request.query);
    const total = await prisma.user.count();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true,
        role: true,
        email: true,
        phone: true,
        bitrixContactId: true,
        allowedDepth: true,
        isActive: true,
        createdAt: true
      }
    });
    return { items: users, page: q.page, pageSize: q.pageSize, total };
  });

  fastify.post("/users", { preHandler: requireAdminWithMfa }, async (request, reply) => {
    const Body = z.object({
      role: z.enum(["client", "admin"]),
      email: z.string().email().optional(),
      phone: z.string().min(7).max(32).optional(),
      password: z.string().min(8).optional(),
      bitrixContactId: z.string().min(1),
      allowedDepth: z.coerce.number().int().min(1).max(99).optional()
    });
    const b = Body.parse(request.body);
    if (!b.email && !b.phone) {
      reply.code(400);
      return { error: "EMAIL_OR_PHONE_REQUIRED" };
    }

    const passwordHash = b.password ? await hashPassword(b.password) : null;
    const user = await prisma.user.create({
      data: {
        role: b.role,
        email: b.email?.toLowerCase() ?? null,
        phone: b.phone ?? null,
        passwordHash,
        bitrixContactId: b.bitrixContactId,
        allowedDepth: b.allowedDepth ?? (b.role === "client" ? 1 : 99)
      }
    });

    await writeAudit({ request, userId: request.user.sub, action: "admin.user.create", data: { userId: user.id } });
    return { id: user.id };
  });

  fastify.patch("/users/:id/allowed-depth", { preHandler: requireAdminWithMfa }, async (request) => {
    const Params = z.object({ id: z.string().min(1) });
    const Body = z.object({ allowedDepth: z.coerce.number().int().min(1).max(99) });
    const { id } = Params.parse(request.params);
    const { allowedDepth } = Body.parse(request.body);

    const user = await prisma.user.update({ where: { id }, data: { allowedDepth } });
    await writeAudit({
      request,
      userId: request.user.sub,
      action: "admin.user.allowedDepth.set",
      data: { targetUserId: id, allowedDepth }
    });
    return { id: user.id, allowedDepth: user.allowedDepth };
  });

  fastify.get("/recommendations/flat", { preHandler: requireAdminWithMfa }, async (request) => {
    const Query = z.object({
      rootBitrixId: z.string().min(1),
      depth: z.coerce.number().int().min(1).max(50).default(10),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(50),
      sort: z.enum(["contractDate", "reward", "fullName", "depth"]).default("depth"),
      order: z.enum(["asc", "desc"]).default("asc")
    });
    const q = Query.parse(request.query);

    const flat = await fastify.referrals.buildFlatTree({ rootBitrixId: q.rootBitrixId, maxDepth: q.depth });
    const sorted = flat.sort((a, b) => {
      const dir = q.order === "asc" ? 1 : -1;
      if (q.sort === "reward") return (a.rewardAmount - b.rewardAmount) * dir;
      if (q.sort === "fullName") return a.fullName.localeCompare(b.fullName) * dir;
      if (q.sort === "contractDate")
        return (new Date(a.contractDate).getTime() - new Date(b.contractDate).getTime()) * dir;
      return (a.depth - b.depth) * dir;
    });

    const total = sorted.length;
    const start = (q.page - 1) * q.pageSize;
    const items = sorted.slice(start, start + q.pageSize).map((r) => ({
      ...r,
      reward: { currency: "RUB", amount: r.rewardAmount }
    }));

    await writeAudit({
      request,
      userId: request.user.sub,
      action: "admin.recommendations.flat",
      data: { ...q }
    });
    return { items, page: q.page, pageSize: q.pageSize, total };
  });

  fastify.get("/recommendations/children", { preHandler: requireAdminWithMfa }, async (request) => {
    const Query = z.object({ referrerBitrixId: z.string().min(1) });
    const q = Query.parse(request.query);

    const edges = await prisma.referralEdge.findMany({ where: { referrerBitrixId: q.referrerBitrixId } });
    const ids = edges.map((e) => e.referredBitrixId);
    const childCounts = await prisma.referralEdge.groupBy({
      by: ["referrerBitrixId"],
      where: { referrerBitrixId: { in: ids } },
      _count: { _all: true }
    });
    const countMap = new Map(childCounts.map((x) => [x.referrerBitrixId, x._count._all]));
    const contracts = await prisma.contract.findMany({ where: { referredBitrixId: { in: ids } } });
    const rewardMap = new Map<string, number>();
    for (const c of contracts) rewardMap.set(c.referredBitrixId, (rewardMap.get(c.referredBitrixId) ?? 0) + c.rewardAmount);

    const items = await Promise.all(
      ids.map(async (id) => ({
        bitrixContactId: id,
        fullName: await fastify.bitrix.getFullName(id),
        hasChildren: (countMap.get(id) ?? 0) > 0,
        directReward: { currency: "RUB", amount: rewardMap.get(id) ?? 0 }
      }))
    );

    await writeAudit({
      request,
      userId: request.user.sub,
      action: "admin.tree.expand",
      data: { referrerBitrixId: q.referrerBitrixId, count: items.length }
    });

    return { items };
  });

  fastify.get("/audit", { preHandler: requireAdminWithMfa }, async (request) => {
    const Query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(50)
    });
    const q = Query.parse(request.query);
    const total = await prisma.auditLog.count();
    const items = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize
    });
    return { items, page: q.page, pageSize: q.pageSize, total };
  });
}


