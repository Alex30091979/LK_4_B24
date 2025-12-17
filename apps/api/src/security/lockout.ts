import type { Storage } from "../storage/storage.js";

export async function getLockout(storage: Storage, key: string) {
  const row = await storage.attemptFind(key);
  if (!row?.blockedUntil) return null;
  if (row.blockedUntil.getTime() <= Date.now()) return null;
  return row.blockedUntil;
}

export async function registerAuthFailure(storage: Storage, key: string) {
  const now = new Date();
  const row = await storage.attemptUpsertIncrement(key, now);

  // Lockout policy (simple + reliable):
  // - After 8 failures -> block 15 minutes
  // - Exponential backoff signal via retryAfterMs (client can wait)
  const failures = row.count;
  const blockedUntil =
    failures >= 8 ? new Date(Date.now() + 15 * 60 * 1000) : row.blockedUntil ?? null;

  if (blockedUntil && (!row.blockedUntil || row.blockedUntil.getTime() !== blockedUntil.getTime())) {
    await storage.attemptUpdate(key, { blockedUntil });
  }

  const retryAfterMs = Math.min(Math.pow(2, Math.max(failures - 1, 0)) * 500, 8000);
  return { failures, blockedUntil, retryAfterMs };
}

export async function registerAuthSuccess(storage: Storage, key: string) {
  await storage.attemptDelete(key);
}


