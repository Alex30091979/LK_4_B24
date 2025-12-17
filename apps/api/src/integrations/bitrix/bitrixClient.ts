import { fetch } from "undici";

export type BitrixContact = {
  id: string;
  fullName: string;
};

export interface BitrixClient {
  getContact(id: string): Promise<BitrixContact | null>;
  listContacts(args: { select: string[]; start?: number }): Promise<{ items: any[]; next?: number | null }>;
  listDeals(args: { select: string[]; start?: number }): Promise<{ items: any[]; next?: number | null }>;
}

export class MockBitrixClient implements BitrixClient {
  private contacts: Record<string, BitrixContact> = {
    "1000": { id: "1000", fullName: "Администратор Демо" },
    "2000": { id: "2000", fullName: "Клиент Рекомендатель" },
    "2001": { id: "2001", fullName: "Рекомендация 1" },
    "2002": { id: "2002", fullName: "Рекомендация 2" },
    "2003": { id: "2003", fullName: "Рекомендация 1-1" }
  };

  async getContact(id: string) {
    return this.contacts[id] ?? { id, fullName: `Контакт #${id}` };
  }

  async listContacts() {
    const items = Object.values(this.contacts).map((c) => ({ ID: c.id, NAME: c.fullName }));
    return { items, next: null };
  }

  async listDeals() {
    return { items: [], next: null };
  }
}

export class RealBitrixClient implements BitrixClient {
  constructor(private args: { baseUrl: string; webhookPath: string }) {}

  private url(method: string) {
    const base = this.args.baseUrl.replace(/\/+$/, "");
    const path = this.args.webhookPath.replace(/^\//, "").replace(/\/+$/, "");
    return `${base}/${path}/${method}.json`;
  }

  private async call(method: string, params: Record<string, any>) {
    const res = await fetch(this.url(method), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params)
    });
    const json = (await res.json()) as any;
    if (!res.ok) throw new Error(`Bitrix ${method} failed: HTTP ${res.status}`);
    if (json?.error) throw new Error(`Bitrix ${method} failed: ${json.error} ${json.error_description ?? ""}`.trim());
    return json;
  }

  async getContact(id: string) {
    const json = await this.call("crm.contact.get", { id });
    const c = json?.result;
    if (!c) return null;
    const fullName = [c.LAST_NAME, c.NAME, c.SECOND_NAME].filter(Boolean).join(" ").trim() || `Контакт #${id}`;
    return { id: String(c.ID ?? id), fullName };
  }

  async listContacts(args: { select: string[]; start?: number }) {
    const json = await this.call("crm.contact.list", {
      order: { ID: "ASC" },
      filter: {},
      select: args.select,
      start: args.start ?? 0
    });
    const items = (json?.result ?? []) as any[];
    const next = json?.next ?? null;
    return { items, next };
  }

  async listDeals(args: { select: string[]; start?: number }) {
    const json = await this.call("crm.deal.list", {
      order: { ID: "ASC" },
      filter: {},
      select: args.select,
      start: args.start ?? 0
    });
    const items = (json?.result ?? []) as any[];
    const next = json?.next ?? null;
    return { items, next };
  }
}


