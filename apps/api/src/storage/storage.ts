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

export interface Storage {
  init(): Promise<void>;

  // Users
  userFindById(id: string): Promise<DbUser | null>;
  userFindByEmail(emailLower: string): Promise<DbUser | null>;
  userFindByPhone(phone: string): Promise<DbUser | null>;
  userCreate(data: Partial<DbUser> & Pick<DbUser, "role" | "bitrixContactId">): Promise<DbUser>;
  userUpdateAllowedDepth(id: string, allowedDepth: number): Promise<DbUser>;
  userCount(): Promise<number>;
  userList(args: { skip: number; take: number }): Promise<DbUser[]>;

  // Sessions
  sessionCreate(data: DbAuthSession): Promise<void>;
  sessionFindById(id: string): Promise<DbAuthSession | null>;
  sessionUpdate(id: string, patch: Partial<DbAuthSession>): Promise<void>;

  // TOTP
  totpFindByUserId(userId: string): Promise<DbTotpSecret | null>;
  totpUpsert(userId: string, secretEnc: string, enabled: boolean): Promise<void>;
  totpUpdate(userId: string, patch: Partial<DbTotpSecret>): Promise<void>;

  // SMS codes
  smsCreate(data: DbSmsCode): Promise<void>;
  smsFindLatestActive(phone: string, now: Date): Promise<DbSmsCode | null>;
  smsUpdate(id: string, patch: Partial<DbSmsCode>): Promise<void>;

  // Auth attempts / lockout
  attemptFind(key: string): Promise<DbAuthAttempt | null>;
  attemptUpsertIncrement(key: string, now: Date): Promise<DbAuthAttempt>;
  attemptUpdate(key: string, patch: Partial<DbAuthAttempt>): Promise<void>;
  attemptDelete(key: string): Promise<void>;

  // Audit
  auditCreate(row: DbAuditLog): Promise<void>;
  auditCount(): Promise<number>;
  auditList(args: { skip: number; take: number }): Promise<DbAuditLog[]>;

  // App settings
  settingFind(key: string): Promise<DbAppSetting | null>;
  settingUpsert(key: string, value: string): Promise<void>;

  // Referrals / contracts
  referralEdgesByReferrerIds(referrerIds: string[]): Promise<DbReferralEdge[]>;
  referralEdgesByReferrerId(referrerId: string): Promise<DbReferralEdge[]>;
  referralEdgesDeleteBySource(source: string): Promise<void>;
  referralEdgesCreateMany(rows: Array<Omit<DbReferralEdge, "id" | "createdAt" | "updatedAt">>): Promise<void>;
  referralChildCounts(referrerIds: string[]): Promise<Map<string, number>>;

  contractsByReferredIds(referredIds: string[]): Promise<DbContract[]>;
  contractFindById(id: string): Promise<DbContract | null>;
  contractsDeleteBySource(source: string): Promise<void>;
  contractUpsertByDealId(args: Omit<DbContract, "id" | "updatedAt"> & { id?: string }): Promise<void>;
}


