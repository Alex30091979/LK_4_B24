import { prisma } from "../../prisma.js";
import type { AppConfig } from "../../config.js";
import type { BitrixClient } from "./bitrixClient.js";

export class BitrixSyncService {
  constructor(
    private args: {
      config: AppConfig;
      client: BitrixClient;
    }
  ) {}

  /**
   * Partial sync skeleton.
   *
   * Real Bitrix24 mapping varies by implementation (contacts/deals/custom fields).
   * This method is intentionally conservative: it updates only local cache tables
   * and can be extended without changing API contracts.
   */
  async syncPartial() {
    const startedAt = new Date();

    const lastSync = await prisma.appSetting.findUnique({ where: { key: "bitrix.lastSyncAt" } });
    const since = lastSync ? new Date(lastSync.value) : null;

    if (this.args.config.BITRIX_MODE !== "real") {
      await prisma.appSetting.upsert({
        where: { key: "bitrix.lastSyncAt" },
        create: { key: "bitrix.lastSyncAt", value: startedAt.toISOString() },
        update: { value: startedAt.toISOString() }
      });
      return { mode: "mock", since: since?.toISOString() ?? null, updatedEdges: 0, updatedContracts: 0 };
    }

    const refField = this.args.config.BITRIX_REFERRER_FIELD;
    const dealRewardField = this.args.config.BITRIX_DEAL_REWARD_FIELD;
    const dealDateField = this.args.config.BITRIX_DEAL_DATE_FIELD;

    // MVP approach (simple & reliable):
    // - pull all required entities with paging
    // - replace local bitrix-sourced snapshots (delete + recreate)
    // This avoids tricky deltas until the Bitrix field mapping is finalized.

    // 1) Contacts -> referral edges (referrer -> referred)
    const edges: { referrerBitrixId: string; referredBitrixId: string; source: string }[] = [];
    let cStart = 0;
    // select: include referral field
    const contactSelect = ["ID", "NAME", "LAST_NAME", "SECOND_NAME", refField];
    while (true) {
      const { items, next } = await this.args.client.listContacts({ select: contactSelect, start: cStart });
      for (const c of items) {
        const referredId = String(c.ID ?? "").trim();
        if (!referredId) continue;
        const referrer = c[refField];
        const referrerId =
          typeof referrer === "string" || typeof referrer === "number" ? String(referrer).trim() : "";
        if (!referrerId) continue;
        edges.push({ referrerBitrixId: referrerId, referredBitrixId: referredId, source: "bitrix" });
      }
      if (next == null) break;
      cStart = Number(next);
    }

    // 2) Deals -> contracts (referred = CONTACT_ID)
    const contracts: {
      bitrixDealId: string;
      referredBitrixId: string;
      contractDate: Date;
      rewardAmount: number;
      currency: string;
      status: "active" | "inactive";
      source: string;
    }[] = [];

    let dStart = 0;
    const dealSelect = ["ID", "CONTACT_ID", "DATE_CREATE", "CLOSEDATE", "CLOSED", dealRewardField];
    while (true) {
      const { items, next } = await this.args.client.listDeals({ select: dealSelect, start: dStart });
      for (const d of items) {
        const bitrixDealId = String(d.ID ?? "").trim();
        const referredBitrixId = String(d.CONTACT_ID ?? "").trim();
        if (!bitrixDealId || !referredBitrixId) continue;

        const rewardRaw = d[dealRewardField];
        const rewardAmount = Number(String(rewardRaw ?? "0").replace(",", "."));
        if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) continue;

        const dateRaw = d[dealDateField] ?? d.CLOSEDATE ?? d.DATE_CREATE;
        const contractDate = dateRaw ? new Date(dateRaw) : new Date();
        const closed = String(d.CLOSED ?? "N").toUpperCase() === "Y";
        const status = closed ? "inactive" : "active";

        contracts.push({
          bitrixDealId,
          referredBitrixId,
          contractDate,
          rewardAmount: Math.round(rewardAmount),
          currency: "RUB",
          status,
          source: "bitrix"
        });
      }
      if (next == null) break;
      dStart = Number(next);
    }

    await prisma.$transaction(async (tx) => {
      await tx.referralEdge.deleteMany({ where: { source: "bitrix" } });
      await tx.contract.deleteMany({ where: { source: "bitrix" } });

      if (edges.length > 0) {
        await tx.referralEdge.createMany({ data: edges, skipDuplicates: true });
      }

      for (const c of contracts) {
        await tx.contract.upsert({
          where: { bitrixDealId: c.bitrixDealId },
          create: c as any,
          update: {
            referredBitrixId: c.referredBitrixId,
            contractDate: c.contractDate,
            rewardAmount: c.rewardAmount,
            currency: c.currency,
            status: c.status as any,
            source: c.source
          }
        });
      }

      await tx.appSetting.upsert({
        where: { key: "bitrix.lastSyncAt" },
        create: { key: "bitrix.lastSyncAt", value: startedAt.toISOString() },
        update: { value: startedAt.toISOString() }
      });
    });

    return {
      mode: "real",
      since: since?.toISOString() ?? null,
      updatedEdges: edges.length,
      updatedContracts: contracts.length
    };
  }
}


