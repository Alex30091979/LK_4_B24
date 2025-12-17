import type { Storage } from "../storage.js";
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
} from "../types.js";
import { SheetsClient } from "./sheetsClient.js";
import { SheetsTable } from "./sheetsTable.js";

const SHEETS = {
  Users: {
    name: "Users",
    cols: [
      "id",
      "role",
      "email",
      "phone",
      "passwordHash",
      "bitrixContactId",
      "allowedDepth",
      "isActive",
      "createdAt",
      "updatedAt"
    ]
  },
  AuthSessions: {
    name: "AuthSessions",
    cols: [
      "id",
      "userId",
      "refreshTokenHash",
      "refreshJti",
      "mfaVerified",
      "createdAt",
      "lastUsedAt",
      "expiresAt",
      "revokedAt",
      "ip",
      "userAgent"
    ]
  },
  TotpSecrets: { name: "TotpSecrets", cols: ["id", "userId", "secretEnc", "enabled", "createdAt", "updatedAt"] },
  SmsCodes: {
    name: "SmsCodes",
    cols: [
      "id",
      "phone",
      "codeHash",
      "createdAt",
      "expiresAt",
      "consumedAt",
      "attempts",
      "maxAttempts",
      "blockedUntil",
      "ip"
    ]
  },
  AuthAttempts: { name: "AuthAttempts", cols: ["id", "key", "count", "firstAt", "lastAt", "blockedUntil"] },
  AuditLog: { name: "AuditLog", cols: ["id", "userId", "action", "data", "ip", "userAgent", "createdAt"] },
  AppSettings: { name: "AppSettings", cols: ["key", "value", "updatedAt"] },
  ReferralEdges: {
    name: "ReferralEdges",
    cols: ["id", "referrerBitrixId", "referredBitrixId", "source", "createdAt", "updatedAt"]
  },
  Contracts: {
    name: "Contracts",
    cols: [
      "id",
      "bitrixDealId",
      "referredBitrixId",
      "contractDate",
      "rewardAmount",
      "currency",
      "status",
      "source",
      "updatedAt"
    ]
  }
} as const;

export class SheetsStorage implements Storage {
  private client: SheetsClient;
  private users: SheetsTable<any>;
  private sessions: SheetsTable<any>;
  private totp: SheetsTable<any>;
  private sms: SheetsTable<any>;
  private attempts: SheetsTable<any>;
  private audit: SheetsTable<any>;
  private settings: SheetsTable<any>;
  private edges: SheetsTable<any>;
  private contracts: SheetsTable<any>;

  constructor(args: { spreadsheetId: string; serviceAccountJsonBase64: string }) {
    this.client = new SheetsClient({ spreadsheetId: args.spreadsheetId, serviceAccountJsonBase64: args.serviceAccountJsonBase64 });

    this.users = new SheetsTable({ client: this.client, sheetName: SHEETS.Users.name, columns: [...SHEETS.Users.cols], idColumn: "id" });
    this.sessions = new SheetsTable({ client: this.client, sheetName: SHEETS.AuthSessions.name, columns: [...SHEETS.AuthSessions.cols], idColumn: "id" });
    this.totp = new SheetsTable({ client: this.client, sheetName: SHEETS.TotpSecrets.name, columns: [...SHEETS.TotpSecrets.cols], idColumn: "userId" });
    this.sms = new SheetsTable({ client: this.client, sheetName: SHEETS.SmsCodes.name, columns: [...SHEETS.SmsCodes.cols], idColumn: "id" });
    this.attempts = new SheetsTable({ client: this.client, sheetName: SHEETS.AuthAttempts.name, columns: [...SHEETS.AuthAttempts.cols], idColumn: "key" });
    this.audit = new SheetsTable({ client: this.client, sheetName: SHEETS.AuditLog.name, columns: [...SHEETS.AuditLog.cols], idColumn: "id" });
    this.settings = new SheetsTable({ client: this.client, sheetName: SHEETS.AppSettings.name, columns: [...SHEETS.AppSettings.cols], idColumn: "key" });
    this.edges = new SheetsTable({ client: this.client, sheetName: SHEETS.ReferralEdges.name, columns: [...SHEETS.ReferralEdges.cols], idColumn: "id" });
    this.contracts = new SheetsTable({ client: this.client, sheetName: SHEETS.Contracts.name, columns: [...SHEETS.Contracts.cols], idColumn: "bitrixDealId" });
  }

  async init(): Promise<void> {
    const ss = await this.client.getSpreadsheet();
    const existing = new Set((ss.sheets ?? []).map((s: any) => s.properties?.title).filter(Boolean));
    for (const k of Object.keys(SHEETS) as Array<keyof typeof SHEETS>) {
      const title = SHEETS[k].name;
      if (!existing.has(title)) await this.client.addSheet(title);
    }
    await Promise.all([
      this.users.ensureHeader(),
      this.sessions.ensureHeader(),
      this.totp.ensureHeader(),
      this.sms.ensureHeader(),
      this.attempts.ensureHeader(),
      this.audit.ensureHeader(),
      this.settings.ensureHeader(),
      this.edges.ensureHeader(),
      this.contracts.ensureHeader()
    ]);
  }

  // Users
  async userFindById(id: string): Promise<DbUser | null> {
    const hit = await this.users.findFirst((r) => String(r.id) === id);
    return hit ? mapUser(hit.row) : null;
  }
  async userFindByEmail(emailLower: string): Promise<DbUser | null> {
    const hit = await this.users.findFirst((r) => String(r.email ?? "").toLowerCase() === emailLower);
    return hit ? mapUser(hit.row) : null;
  }
  async userFindByPhone(phone: string): Promise<DbUser | null> {
    const hit = await this.users.findFirst((r) => String(r.phone ?? "") === phone);
    return hit ? mapUser(hit.row) : null;
  }
  async userCreate(data: Partial<DbUser> & Pick<DbUser, "role" | "bitrixContactId">): Promise<DbUser> {
    const now = new Date();
    const id = data.id ?? this.users.newId("u_");
    const row = {
      id,
      role: data.role,
      email: data.email ?? "",
      phone: data.phone ?? "",
      passwordHash: data.passwordHash ?? "",
      bitrixContactId: data.bitrixContactId,
      allowedDepth: String(data.allowedDepth ?? (data.role === "client" ? 1 : 99)),
      isActive: String(data.isActive ?? true),
      createdAt: SheetsTable.iso(data.createdAt ?? now),
      updatedAt: SheetsTable.iso(data.updatedAt ?? now)
    };
    await this.users.append(row);
    return mapUser(row);
  }
  async userUpdateAllowedDepth(id: string, allowedDepth: number): Promise<DbUser> {
    const hit = await this.users.findFirst((r) => String(r.id) === id);
    if (!hit) throw new Error("User not found");
    await this.users.updateByRowIndex(hit.rowIndex1, { allowedDepth: String(allowedDepth), updatedAt: new Date().toISOString() });
    return { ...mapUser(hit.row), allowedDepth, updatedAt: new Date() };
  }
  async userCount(): Promise<number> {
    const all = await this.users.readAll();
    return all.length;
  }
  async userList(args: { skip: number; take: number }): Promise<DbUser[]> {
    const all = await this.users.readAll();
    const sorted = all
      .slice()
      .sort((a, b) => SheetsTable.date(String(b.createdAt)).getTime() - SheetsTable.date(String(a.createdAt)).getTime());
    return sorted.slice(args.skip, args.skip + args.take).map(mapUser);
  }

  // Sessions
  async sessionCreate(data: DbAuthSession): Promise<void> {
    await this.sessions.append({
      id: data.id,
      userId: data.userId,
      refreshTokenHash: data.refreshTokenHash,
      refreshJti: data.refreshJti,
      mfaVerified: String(data.mfaVerified),
      createdAt: data.createdAt.toISOString(),
      lastUsedAt: data.lastUsedAt.toISOString(),
      expiresAt: data.expiresAt.toISOString(),
      revokedAt: data.revokedAt ? data.revokedAt.toISOString() : "",
      ip: data.ip ?? "",
      userAgent: data.userAgent ?? ""
    });
  }
  async sessionFindById(id: string): Promise<DbAuthSession | null> {
    const hit = await this.sessions.findFirst((r) => String(r.id) === id);
    return hit ? mapSession(hit.row) : null;
  }
  async sessionUpdate(id: string, patch: Partial<DbAuthSession>): Promise<void> {
    const hit = await this.sessions.findFirst((r) => String(r.id) === id);
    if (!hit) throw new Error("Session not found");
    await this.sessions.updateByRowIndex(hit.rowIndex1, serializeSessionPatch(patch));
  }

  // TOTP
  async totpFindByUserId(userId: string): Promise<DbTotpSecret | null> {
    const hit = await this.totp.findFirst((r) => String(r.userId) === userId);
    return hit ? mapTotp(hit.row) : null;
  }
  async totpUpsert(userId: string, secretEnc: string, enabled: boolean): Promise<void> {
    const hit = await this.totp.findFirst((r) => String(r.userId) === userId);
    const now = new Date().toISOString();
    if (!hit) {
      await this.totp.append({
        id: this.totp.newId("t_"),
        userId,
        secretEnc,
        enabled: String(enabled),
        createdAt: now,
        updatedAt: now
      });
      return;
    }
    await this.totp.updateByRowIndex(hit.rowIndex1, { secretEnc, enabled: String(enabled), updatedAt: now });
  }
  async totpUpdate(userId: string, patch: Partial<DbTotpSecret>): Promise<void> {
    const hit = await this.totp.findFirst((r) => String(r.userId) === userId);
    if (!hit) throw new Error("TOTP not found");
    const p: any = {};
    if (patch.secretEnc !== undefined) p.secretEnc = patch.secretEnc;
    if (patch.enabled !== undefined) p.enabled = String(patch.enabled);
    p.updatedAt = new Date().toISOString();
    await this.totp.updateByRowIndex(hit.rowIndex1, p);
  }

  // SMS
  async smsCreate(data: DbSmsCode): Promise<void> {
    await this.sms.append({
      id: data.id,
      phone: data.phone,
      codeHash: data.codeHash,
      createdAt: data.createdAt.toISOString(),
      expiresAt: data.expiresAt.toISOString(),
      consumedAt: data.consumedAt ? data.consumedAt.toISOString() : "",
      attempts: String(data.attempts),
      maxAttempts: String(data.maxAttempts),
      blockedUntil: data.blockedUntil ? data.blockedUntil.toISOString() : "",
      ip: data.ip ?? ""
    });
  }
  async smsFindLatestActive(phone: string, now: Date): Promise<DbSmsCode | null> {
    const all = await this.sms.readAll();
    const filtered = all
      .filter((r) => String(r.phone) === phone)
      .map(mapSms)
      .filter((r) => !r.consumedAt && r.expiresAt.getTime() > now.getTime())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return filtered[0] ?? null;
  }
  async smsUpdate(id: string, patch: Partial<DbSmsCode>): Promise<void> {
    const hit = await this.sms.findFirst((r) => String(r.id) === id);
    if (!hit) throw new Error("SMS not found");
    const p: any = {};
    if (patch.attempts !== undefined) p.attempts = String(patch.attempts);
    if (patch.consumedAt !== undefined) p.consumedAt = patch.consumedAt ? patch.consumedAt.toISOString() : "";
    if (patch.blockedUntil !== undefined) p.blockedUntil = patch.blockedUntil ? patch.blockedUntil.toISOString() : "";
    await this.sms.updateByRowIndex(hit.rowIndex1, p);
  }

  // Attempts
  async attemptFind(key: string): Promise<DbAuthAttempt | null> {
    const hit = await this.attempts.findFirst((r) => String(r.key) === key);
    return hit ? mapAttempt(hit.row) : null;
  }
  async attemptUpsertIncrement(key: string, now: Date): Promise<DbAuthAttempt> {
    const hit = await this.attempts.findFirst((r) => String(r.key) === key);
    if (!hit) {
      const row = {
        id: this.attempts.newId("a_"),
        key,
        count: "1",
        firstAt: now.toISOString(),
        lastAt: now.toISOString(),
        blockedUntil: ""
      };
      await this.attempts.append(row);
      return mapAttempt(row);
    }
    const current = mapAttempt(hit.row);
    const nextCount = current.count + 1;
    await this.attempts.updateByRowIndex(hit.rowIndex1, { count: String(nextCount), lastAt: now.toISOString() });
    return { ...current, count: nextCount, lastAt: now };
  }
  async attemptUpdate(key: string, patch: Partial<DbAuthAttempt>): Promise<void> {
    const hit = await this.attempts.findFirst((r) => String(r.key) === key);
    if (!hit) throw new Error("Attempt not found");
    const p: any = {};
    if (patch.count !== undefined) p.count = String(patch.count);
    if (patch.blockedUntil !== undefined) p.blockedUntil = patch.blockedUntil ? patch.blockedUntil.toISOString() : "";
    if (patch.lastAt !== undefined) p.lastAt = patch.lastAt.toISOString();
    await this.attempts.updateByRowIndex(hit.rowIndex1, p);
  }
  async attemptDelete(key: string): Promise<void> {
    // MVP: we don't physically delete rows to avoid shifting indexes; we reset instead.
    const hit = await this.attempts.findFirst((r) => String(r.key) === key);
    if (!hit) return;
    await this.attempts.updateByRowIndex(hit.rowIndex1, { count: "0", blockedUntil: "" });
  }

  // Audit
  async auditCreate(row: DbAuditLog): Promise<void> {
    await this.audit.append({
      id: row.id,
      userId: row.userId ?? "",
      action: row.action,
      data: row.data ? JSON.stringify(row.data) : "",
      ip: row.ip ?? "",
      userAgent: row.userAgent ?? "",
      createdAt: row.createdAt.toISOString()
    });
  }
  async auditCount(): Promise<number> {
    const all = await this.audit.readAll();
    return all.length;
  }
  async auditList(args: { skip: number; take: number }): Promise<DbAuditLog[]> {
    const all = await this.audit.readAll();
    const sorted = all
      .slice()
      .sort((a, b) => SheetsTable.date(String(b.createdAt)).getTime() - SheetsTable.date(String(a.createdAt)).getTime());
    return sorted.slice(args.skip, args.skip + args.take).map(mapAudit);
  }

  // Settings
  async settingFind(key: string): Promise<DbAppSetting | null> {
    const hit = await this.settings.findFirst((r) => String(r.key) === key);
    return hit ? mapSetting(hit.row) : null;
  }
  async settingUpsert(key: string, value: string): Promise<void> {
    const hit = await this.settings.findFirst((r) => String(r.key) === key);
    const now = new Date().toISOString();
    if (!hit) {
      await this.settings.append({ key, value, updatedAt: now });
      return;
    }
    await this.settings.updateByRowIndex(hit.rowIndex1, { value, updatedAt: now });
  }

  // Referrals
  async referralEdgesByReferrerIds(referrerIds: string[]): Promise<DbReferralEdge[]> {
    const set = new Set(referrerIds);
    const all = await this.edges.readAll();
    return all
      .filter((r) => String(r.source ?? "") !== "")
      .filter((r) => set.has(String(r.referrerBitrixId)))
      .map(mapEdge);
  }
  async referralEdgesByReferrerId(referrerId: string): Promise<DbReferralEdge[]> {
    const all = await this.edges.readAll();
    return all
      .filter((r) => String(r.source ?? "") !== "")
      .filter((r) => String(r.referrerBitrixId) === referrerId)
      .map(mapEdge);
  }
  async referralEdgesDeleteBySource(source: string): Promise<void> {
    // MVP: can't delete rows; we mark by clearing source
    const all = await this.edges.readAll();
    for (const r of all) {
      if (String(r.source) !== source) continue;
      const hit = await this.edges.findFirst((x) => String(x.id) === String(r.id));
      if (hit) await this.edges.updateByRowIndex(hit.rowIndex1, { source: "" });
    }
  }
  async referralEdgesCreateMany(rows: Array<Omit<DbReferralEdge, "id" | "createdAt" | "updatedAt">>): Promise<void> {
    const now = new Date().toISOString();
    for (const r of rows) {
      await this.edges.append({
        id: this.edges.newId("e_"),
        referrerBitrixId: r.referrerBitrixId,
        referredBitrixId: r.referredBitrixId,
        source: r.source,
        createdAt: now,
        updatedAt: now
      });
    }
  }
  async referralChildCounts(referrerIds: string[]): Promise<Map<string, number>> {
    const set = new Set(referrerIds);
    const all = await this.edges.readAll();
    const map = new Map<string, number>();
    for (const r of all) {
      if (String(r.source ?? "") === "") continue;
      const k = String(r.referrerBitrixId);
      if (!set.has(k)) continue;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }

  // Contracts
  async contractsByReferredIds(referredIds: string[]): Promise<DbContract[]> {
    const set = new Set(referredIds);
    const all = await this.contracts.readAll();
    return all
      .filter((r) => String(r.source ?? "") !== "")
      .filter((r) => set.has(String(r.referredBitrixId)))
      .map(mapContract);
  }
  async contractFindById(id: string): Promise<DbContract | null> {
    const hit = await this.contracts.findFirst((r) => String(r.id) === id);
    if (!hit) return null;
    if (String(hit.row.source ?? "") === "") return null;
    return mapContract(hit.row);
  }
  async contractsDeleteBySource(source: string): Promise<void> {
    const all = await this.contracts.readAll();
    for (const r of all) {
      if (String(r.source) !== source) continue;
      const hit = await this.contracts.findFirst((x) => String(x.id) === String(r.id));
      if (hit) await this.contracts.updateByRowIndex(hit.rowIndex1, { source: "" });
    }
  }
  async contractUpsertByDealId(args: Omit<DbContract, "id" | "updatedAt"> & { id?: string }): Promise<void> {
    const hit = await this.contracts.findFirst((r) => String(r.bitrixDealId) === args.bitrixDealId);
    const now = new Date().toISOString();
    if (!hit) {
      await this.contracts.append({
        id: args.id ?? this.contracts.newId("c_"),
        bitrixDealId: args.bitrixDealId,
        referredBitrixId: args.referredBitrixId,
        contractDate: args.contractDate.toISOString(),
        rewardAmount: String(args.rewardAmount),
        currency: args.currency,
        status: args.status,
        source: args.source,
        updatedAt: now
      });
      return;
    }
    await this.contracts.updateByRowIndex(hit.rowIndex1, {
      referredBitrixId: args.referredBitrixId,
      contractDate: args.contractDate.toISOString(),
      rewardAmount: String(args.rewardAmount),
      currency: args.currency,
      status: args.status,
      source: args.source,
      updatedAt: now
    });
  }
}

function mapUser(r: any): DbUser {
  return {
    id: String(r.id),
    role: (String(r.role) as any) ?? "client",
    email: r.email ? String(r.email) : null,
    phone: r.phone ? String(r.phone) : null,
    passwordHash: r.passwordHash ? String(r.passwordHash) : null,
    bitrixContactId: String(r.bitrixContactId),
    allowedDepth: SheetsTable.int(String(r.allowedDepth)),
    isActive: SheetsTable.bool(String(r.isActive)),
    createdAt: SheetsTable.date(String(r.createdAt)),
    updatedAt: SheetsTable.date(String(r.updatedAt))
  };
}

function mapSession(r: any): DbAuthSession {
  return {
    id: String(r.id),
    userId: String(r.userId),
    refreshTokenHash: String(r.refreshTokenHash),
    refreshJti: String(r.refreshJti),
    mfaVerified: SheetsTable.bool(String(r.mfaVerified)),
    createdAt: SheetsTable.date(String(r.createdAt)),
    lastUsedAt: SheetsTable.date(String(r.lastUsedAt)),
    expiresAt: SheetsTable.date(String(r.expiresAt)),
    revokedAt: r.revokedAt ? SheetsTable.date(String(r.revokedAt)) : null,
    ip: r.ip ? String(r.ip) : null,
    userAgent: r.userAgent ? String(r.userAgent) : null
  };
}

function serializeSessionPatch(patch: Partial<DbAuthSession>) {
  const p: any = {};
  if (patch.refreshJti !== undefined) p.refreshJti = patch.refreshJti;
  if (patch.refreshTokenHash !== undefined) p.refreshTokenHash = patch.refreshTokenHash;
  if (patch.expiresAt !== undefined) p.expiresAt = patch.expiresAt.toISOString();
  if (patch.lastUsedAt !== undefined) p.lastUsedAt = patch.lastUsedAt.toISOString();
  if (patch.revokedAt !== undefined) p.revokedAt = patch.revokedAt ? patch.revokedAt.toISOString() : "";
  if (patch.mfaVerified !== undefined) p.mfaVerified = String(patch.mfaVerified);
  return p;
}

function mapTotp(r: any): DbTotpSecret {
  return {
    id: String(r.id),
    userId: String(r.userId),
    secretEnc: String(r.secretEnc),
    enabled: SheetsTable.bool(String(r.enabled)),
    createdAt: SheetsTable.date(String(r.createdAt)),
    updatedAt: SheetsTable.date(String(r.updatedAt))
  };
}

function mapSms(r: any): DbSmsCode {
  return {
    id: String(r.id),
    phone: String(r.phone),
    codeHash: String(r.codeHash),
    createdAt: SheetsTable.date(String(r.createdAt)),
    expiresAt: SheetsTable.date(String(r.expiresAt)),
    consumedAt: r.consumedAt ? SheetsTable.date(String(r.consumedAt)) : null,
    attempts: SheetsTable.int(String(r.attempts)),
    maxAttempts: SheetsTable.int(String(r.maxAttempts)) || 6,
    blockedUntil: r.blockedUntil ? SheetsTable.date(String(r.blockedUntil)) : null,
    ip: r.ip ? String(r.ip) : null
  };
}

function mapAttempt(r: any): DbAuthAttempt {
  return {
    id: String(r.id),
    key: String(r.key),
    count: SheetsTable.int(String(r.count)),
    firstAt: SheetsTable.date(String(r.firstAt)),
    lastAt: SheetsTable.date(String(r.lastAt)),
    blockedUntil: r.blockedUntil ? SheetsTable.date(String(r.blockedUntil)) : null
  };
}

function mapAudit(r: any): DbAuditLog {
  return {
    id: String(r.id),
    userId: r.userId ? String(r.userId) : null,
    action: String(r.action),
    data: SheetsTable.json(String(r.data)) ?? null,
    ip: r.ip ? String(r.ip) : null,
    userAgent: r.userAgent ? String(r.userAgent) : null,
    createdAt: SheetsTable.date(String(r.createdAt))
  };
}

function mapSetting(r: any): DbAppSetting {
  return {
    key: String(r.key),
    value: String(r.value),
    updatedAt: SheetsTable.date(String(r.updatedAt))
  };
}

function mapEdge(r: any): DbReferralEdge {
  return {
    id: String(r.id),
    referrerBitrixId: String(r.referrerBitrixId),
    referredBitrixId: String(r.referredBitrixId),
    source: String(r.source),
    createdAt: SheetsTable.date(String(r.createdAt)),
    updatedAt: SheetsTable.date(String(r.updatedAt))
  };
}

function mapContract(r: any): DbContract {
  return {
    id: String(r.id),
    bitrixDealId: String(r.bitrixDealId),
    referredBitrixId: String(r.referredBitrixId),
    contractDate: SheetsTable.date(String(r.contractDate)),
    rewardAmount: SheetsTable.int(String(r.rewardAmount)),
    currency: String(r.currency || "RUB"),
    status: String(r.status) === "inactive" ? "inactive" : "active",
    source: String(r.source),
    updatedAt: SheetsTable.date(String(r.updatedAt))
  };
}


