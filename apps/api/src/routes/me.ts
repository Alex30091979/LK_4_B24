import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAccessToken } from "../security/guards.js";
import type { RecommendationItem } from "@lk/shared";
import { writeAudit } from "../audit.js";

export async function meRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: requireAccessToken }, async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) return { error: "NOT_FOUND" };
    return {
      id: user.id,
      role: user.role,
      bitrixContactId: user.bitrixContactId,
      allowedDepth: user.allowedDepth
    };
  });

  fastify.get("/summary", { preHandler: requireAccessToken }, async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) return { error: "NOT_FOUND" };

    const direct = await prisma.referralEdge.findMany({ where: { referrerBitrixId: user.bitrixContactId } });
    const directIds = direct.map((d) => d.referredBitrixId);
    const directContracts = await prisma.contract.findMany({
      where: { referredBitrixId: { in: directIds } }
    });
    const totalReward = directContracts.reduce((sum, c) => sum + c.rewardAmount, 0);

    return {
      directRecommendationsCount: direct.length,
      totalReward: { currency: "RUB", amount: totalReward }
    };
  });

  fastify.get("/recommendations", { preHandler: requireAccessToken }, async (request) => {
    const Query = z.object({
      depth: z.coerce.number().int().min(1).max(50).default(1),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      sort: z.enum(["contractDate", "reward", "fullName"]).default("contractDate"),
      order: z.enum(["asc", "desc"]).default("desc")
    });
    const q = Query.parse(request.query);

    const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) return { error: "NOT_FOUND" };

    const maxDepth = user.role === "admin" ? q.depth : Math.min(q.depth, user.allowedDepth ?? 1);
    const flat = await fastify.referrals.buildFlatTree({ rootBitrixId: user.bitrixContactId, maxDepth });

    const sorted = flat.sort((a, b) => {
      const dir = q.order === "asc" ? 1 : -1;
      if (q.sort === "reward") return (a.rewardAmount - b.rewardAmount) * dir;
      if (q.sort === "fullName") return a.fullName.localeCompare(b.fullName) * dir;
      return (new Date(a.contractDate).getTime() - new Date(b.contractDate).getTime()) * dir;
    });

    const total = sorted.length;
    const start = (q.page - 1) * q.pageSize;
    const items = sorted.slice(start, start + q.pageSize).map(
      (r): RecommendationItem => ({
        referredBitrixContactId: r.referredBitrixContactId,
        fullName: r.fullName,
        contractId: r.contractId,
        contractDate: r.contractDate,
        reward: { currency: "RUB", amount: r.rewardAmount },
        status: r.status,
        depth: r.depth,
        path: r.path
      })
    );

    await writeAudit({ request, userId: user.id, action: "client.recommendations.list", data: { maxDepth, ...q } });
    return { items, page: q.page, pageSize: q.pageSize, total };
  });

  fastify.get("/contracts/:id", { preHandler: requireAccessToken }, async (request, reply) => {
    const Params = z.object({ id: z.string().min(1) });
    const { id } = Params.parse(request.params);
    const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) return { error: "NOT_FOUND" };

    if (user.role === "admin") {
      const c = await prisma.contract.findUnique({ where: { id } });
      if (!c) {
        reply.code(404);
        return { error: "NOT_FOUND" };
      }
      return {
        id: c.id,
        referredBitrixId: c.referredBitrixId,
        contractDate: c.contractDate.toISOString(),
        reward: { currency: "RUB", amount: c.rewardAmount },
        status: c.status
      };
    }

    const visible = await fastify.referrals.isContractVisibleToRoot({
      contractId: id,
      rootBitrixId: user.bitrixContactId,
      maxDepth: user.allowedDepth ?? 1
    });
    if (!visible.visible) {
      reply.code(404);
      return { error: "NOT_FOUND" };
    }

    const c = visible.contract;
    await writeAudit({ request, userId: user.id, action: "client.contract.view", data: { contractId: id } });
    return {
      id: c.id,
      referredBitrixId: c.referredBitrixId,
      contractDate: c.contractDate.toISOString(),
      reward: { currency: "RUB", amount: c.rewardAmount },
      status: c.status
    };
  });
}


