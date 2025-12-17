import type { Role } from "@lk/shared";

export type DbUser = {
  id: string;
  role: Role;
  email: string | null;
  phone: string | null;
  passwordHash: string | null;
  bitrixContactId: string;
  allowedDepth: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type DbAuthSession = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  refreshJti: string;
  mfaVerified: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  ip: string | null;
  userAgent: string | null;
};

export type DbTotpSecret = {
  id: string;
  userId: string;
  secretEnc: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type DbSmsCode = {
  id: string;
  phone: string;
  codeHash: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
  maxAttempts: number;
  blockedUntil: Date | null;
  ip: string | null;
};

export type DbAuthAttempt = {
  id: string;
  key: string;
  count: number;
  firstAt: Date;
  lastAt: Date;
  blockedUntil: Date | null;
};

export type DbAuditLog = {
  id: string;
  userId: string | null;
  action: string;
  data: unknown | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export type DbReferralEdge = {
  id: string;
  referrerBitrixId: string;
  referredBitrixId: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DbContract = {
  id: string;
  bitrixDealId: string;
  referredBitrixId: string;
  contractDate: Date;
  rewardAmount: number;
  currency: string;
  status: "active" | "inactive";
  source: string;
  updatedAt: Date;
};

export type DbAppSetting = {
  key: string;
  value: string;
  updatedAt: Date;
};


