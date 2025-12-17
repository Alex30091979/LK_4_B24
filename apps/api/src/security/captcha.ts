import { prisma } from "../prisma.js";

/**
 * Demo CAPTCHA policy:
 * - CAPTCHA required after 4+ failed attempts for a given key (email/phone).
 * - Verification provider is stubbed (accepts token === "demo-pass").
 *
 * Replace with real provider (reCAPTCHA/HCaptcha) without changing auth flows.
 */
export async function isCaptchaRequired(key: string) {
  const row = await prisma.authAttempt.findUnique({ where: { key } });
  return (row?.count ?? 0) >= 4;
}

export async function verifyCaptcha(args: { token: string; ip?: string }) {
  // Stub: accept only demo token.
  return args.token === "demo-pass";
}


