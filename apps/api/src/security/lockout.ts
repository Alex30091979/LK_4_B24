import { prisma } from "../prisma.js";

export async function getLockout(key: string) {
  const row = await prisma.authAttempt.findUnique({ where: { key } });
  if (!row?.blockedUntil) return null;
  if (row.blockedUntil.getTime() <= Date.now()) return null;
  return row.blockedUntil;
}

export async function registerAuthFailure(key: string) {
  const now = new Date();
  const row = await prisma.authAttempt.upsert({
    where: { key },
    create: { key, count: 1, firstAt: now, lastAt: now },
    update: { count: { increment: 1 }, lastAt: now }
  });

  // Lockout policy (simple + reliable):
  // - After 8 failures -> block 15 minutes
  // - Exponential backoff signal via retryAfterMs (client can wait)
  const failures = row.count;
  const blockedUntil =
    failures >= 8 ? new Date(Date.now() + 15 * 60 * 1000) : row.blockedUntil ?? null;

  if (blockedUntil && (!row.blockedUntil || row.blockedUntil.getTime() !== blockedUntil.getTime())) {
    await prisma.authAttempt.update({ where: { key }, data: { blockedUntil } });
  }

  const retryAfterMs = Math.min(Math.pow(2, Math.max(failures - 1, 0)) * 500, 8000);
  return { failures, blockedUntil, retryAfterMs };
}

export async function registerAuthSuccess(key: string) {
  await prisma.authAttempt.delete({ where: { key } }).catch(() => undefined);
}


