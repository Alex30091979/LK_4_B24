import { LRUCache } from "lru-cache";
import type { BitrixClient } from "./bitrixClient.js";

export class BitrixService {
  private cache = new LRUCache<string, string>({ max: 10_000, ttl: 1000 * 60 * 60 }); // 1h

  constructor(private client: BitrixClient) {}

  async getFullName(contactId: string) {
    const cached = this.cache.get(contactId);
    if (cached) return cached;
    const c = await this.client.getContact(contactId);
    const name = c?.fullName ?? `Контакт #${contactId}`;
    this.cache.set(contactId, name);
    return name;
  }
}



