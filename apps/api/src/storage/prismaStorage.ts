import { prisma } from "../prisma.js";
import type { Storage } from "./storage.js";
import type {
  DbAppSetting,
  DbAuthAttempt,
  DbAuthSession,
  DbAuditLog,
  DbContract,
  DbReferralEdge,
  DbSmsCode,
  DbTotpSecret,
  DbUser
} from "./types.js";

export class PrismaStorage implements Storage {
  async init() {
    // no-op: prisma migrations handled externally
  }

  async userFindById(id: string): Promise<DbUser | null> {
    return prisma.user.findUnique({ where: { id } }) as any;
  }
  async userFindByEmail(emailLower: string): Promise<DbUser | null> {
    return prisma.user.findUnique({ where: { email: emailLower } }) as any;
  }
  async userFindByPhone(phone: string): Promise<DbUser | null> {
    return prisma.user.findUnique({ where: { phone } }) as any;
  }
  async userCreate(data: Partial<DbUser> & Pick<DbUser, "role" | "bitrixContactId">): Promise<DbUser> {
    const now = new Date();
    return (await prisma.user.create({
      data: {
        role: data.role as any,
        email: data.email ?? null,
        phone: data.phone ?? null,
        passwordHash: data.passwordHash ?? null,
        bitrixContactId: data.bitrixContactId,
        allowedDepth: data.allowedDepth ?? (data.role === "client" ? 1 : 99),
        isActive: data.isActive ?? true,
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now
      }
    })) as any;
  }
  async userUpdateAllowedDepth(id: string, allowedDepth: number): Promise<DbUser> {
    return (await prisma.user.update({ where: { id }, data: { allowedDepth } })) as any;
  }
  async userCount(): Promise<number> {
    return prisma.user.count();
  }
  async userList(args: { skip: number; take: number }): Promise<DbUser[]> {
    return (await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      skip: args.skip,
      take: args.take
    })) as any;
  }

  async sessionCreate(data: DbAuthSession): Promise<void> {
    await prisma.authSession.create({ data: data as any });
  }
  async sessionFindById(id: string): Promise<DbAuthSession | null> {
    return (await prisma.authSession.findUnique({ where: { id } })) as any;
  }
  async sessionUpdate(id: string, patch: Partial<DbAuthSession>): Promise<void> {
    await prisma.authSession.update({ where: { id }, data: patch as any });
  }

  async totpFindByUserId(userId: string): Promise<DbTotpSecret | null> {
    return (await prisma.totpSecret.findUnique({ where: { userId } })) as any;
  }
  async totpUpsert(userId: string, secretEnc: string, enabled: boolean): Promise<void> {
    await prisma.totpSecret.upsert({
      where: { userId },
      create: { userId, secretEnc, enabled },
      update: { secretEnc, enabled }
    });
  }
  async totpUpdate(userId: string, patch: Partial<DbTotpSecret>): Promise<void> {
    await prisma.totpSecret.update({ where: { userId }, data: patch as any });
  }

  async smsCreate(data: DbSmsCode): Promise<void> {
    await prisma.smsCode.create({ data: data as any });
  }
  async smsFindLatestActive(phone: string, now: Date): Promise<DbSmsCode | null> {
    return (await prisma.smsCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" }
    })) as any;
  }
  async smsUpdate(id: string, patch: Partial<DbSmsCode>): Promise<void> {
    await prisma.smsCode.update({ where: { id }, data: patch as any });
  }

  async attemptFind(key: string): Promise<DbAuthAttempt | null> {
    return (await prisma.authAttempt.findUnique({ where: { key } })) as any;
  }
  async attemptUpsertIncrement(key: string, now: Date): Promise<DbAuthAttempt> {
    return (await prisma.authAttempt.upsert({
      where: { key },
      create: { key, count: 1, firstAt: now, lastAt: now },
      update: { count: { increment: 1 }, lastAt: now }
    })) as any;
  }
  async attemptUpdate(key: string, patch: Partial<DbAuthAttempt>): Promise<void> {
    await prisma.authAttempt.update({ where: { key }, data: patch as any });
  }
  async attemptDelete(key: string): Promise<void> {
    await prisma.authAttempt.delete({ where: { key } }).catch(() => undefined);
  }

  async auditCreate(row: DbAuditLog): Promise<void> {
    await prisma.auditLog.create({ data: row as any });
  }
  async auditCount(): Promise<number> {
    return prisma.auditLog.count();
  }
  async auditList(args: { skip: number; take: number }): Promise<DbAuditLog[]> {
    return (await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: args.skip,
      take: args.take
    })) as any;
  }

  async settingFind(key: string): Promise<DbAppSetting | null> {
    return (await prisma.appSetting.findUnique({ where: { key } })) as any;
  }
  async settingUpsert(key: string, value: string): Promise<void> {
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value }
    });
  }

  async referralEdgesByReferrerIds(referrerIds: string[]): Promise<DbReferralEdge[]> {
    return (await prisma.referralEdge.findMany({ where: { referrerBitrixId: { in: referrerIds } } })) as any;
  }
  async referralEdgesByReferrerId(referrerId: string): Promise<DbReferralEdge[]> {
    return (await prisma.referralEdge.findMany({ where: { referrerBitrixId: referrerId } })) as any;
  }
  async referralEdgesDeleteBySource(source: string): Promise<void> {
    await prisma.referralEdge.deleteMany({ where: { source } });
  }
  async referralEdgesCreateMany(rows: Array<Omit<DbReferralEdge, "id" | "createdAt" | "updatedAt">>): Promise<void> {
    await prisma.referralEdge.createMany({ data: rows as any, skipDuplicates: true });
  }
  async referralChildCounts(referrerIds: string[]): Promise<Map<string, number>> {
    const groups = await prisma.referralEdge.groupBy({
      by: ["referrerBitrixId"],
      where: { referrerBitrixId: { in: referrerIds } },
      _count: { _all: true }
    });
    return new Map(groups.map((g) => [g.referrerBitrixId, g._count._all]));
  }

  async contractsByReferredIds(referredIds: string[]): Promise<DbContract[]> {
    return (await prisma.contract.findMany({ where: { referredBitrixId: { in: referredIds } } })) as any;
  }
  async contractFindById(id: string): Promise<DbContract | null> {
    return (await prisma.contract.findUnique({ where: { id } })) as any;
  }
  async contractsDeleteBySource(source: string): Promise<void> {
    await prisma.contract.deleteMany({ where: { source } });
  }
  async contractUpsertByDealId(args: Omit<DbContract, "id" | "updatedAt"> & { id?: string }): Promise<void> {
    await prisma.contract.upsert({
      where: { bitrixDealId: args.bitrixDealId },
      create: args as any,
      update: {
        referredBitrixId: args.referredBitrixId,
        contractDate: args.contractDate,
        rewardAmount: args.rewardAmount,
        currency: args.currency,
        status: args.status as any,
        source: args.source
      } as any
    });
  }
}


