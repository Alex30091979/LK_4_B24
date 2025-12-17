import type { ContractStatus } from "@lk/shared";
import type { BitrixService } from "../../integrations/bitrix/bitrixService.js";
import type { Storage } from "../../storage/storage.js";

export type FlatRecommendationRow = {
  referredBitrixContactId: string;
  fullName: string;
  contractId: string;
  contractDate: string;
  rewardAmount: number;
  currency: "RUB";
  status: ContractStatus;
  depth: number;
  path: string[];
};

export class ReferralService {
  constructor(
    private bitrix: BitrixService,
    private storage: Storage
  ) {}

  async getDirectReferrals(referrerBitrixId: string) {
    return this.storage.referralEdgesByReferrerId(referrerBitrixId);
  }

  async buildFlatTree(args: { rootBitrixId: string; maxDepth: number }) {
    const root = args.rootBitrixId;
    const maxDepth = Math.max(1, Math.min(args.maxDepth, 50));

    const depthById = new Map<string, number>();
    const parentById = new Map<string, string>();
    const visited = new Set<string>([root]);
    let frontier: string[] = [root];

    depthById.set(root, 0);

    for (let d = 1; d <= maxDepth; d++) {
      const edges = await this.storage.referralEdgesByReferrerIds(frontier);
      const next: string[] = [];
      for (const e of edges) {
        if (visited.has(e.referredBitrixId)) continue;
        visited.add(e.referredBitrixId);
        depthById.set(e.referredBitrixId, d);
        parentById.set(e.referredBitrixId, e.referrerBitrixId);
        next.push(e.referredBitrixId);
      }
      if (next.length === 0) break;
      frontier = next;
    }

    const allReferred = Array.from(depthById.keys()).filter((x) => x !== root);
    if (allReferred.length === 0) return [];

    const contracts = await this.storage.contractsByReferredIds(allReferred);

    const rows: FlatRecommendationRow[] = [];
    for (const c of contracts) {
      const depth = depthById.get(c.referredBitrixId) ?? 1;
      const path: string[] = [];
      let cur = c.referredBitrixId;
      while (cur && cur !== root) {
        path.unshift(cur);
        cur = parentById.get(cur) ?? "";
      }
      path.unshift(root);

      rows.push({
        referredBitrixContactId: c.referredBitrixId,
        fullName: await this.bitrix.getFullName(c.referredBitrixId),
        contractId: c.id,
        contractDate: c.contractDate.toISOString(),
        rewardAmount: c.rewardAmount,
        currency: "RUB",
        status: c.status as ContractStatus,
        depth,
        path
      });
    }
    return rows;
  }

  async isContractVisibleToRoot(args: { contractId: string; rootBitrixId: string; maxDepth: number }) {
    const contract = await this.storage.contractFindById(args.contractId);
    if (!contract) return { visible: false as const };
    const rows = await this.buildFlatTree({ rootBitrixId: args.rootBitrixId, maxDepth: args.maxDepth });
    const match = rows.find((r) => r.contractId === args.contractId);
    return match ? { visible: true as const, contract } : { visible: false as const };
  }
}


