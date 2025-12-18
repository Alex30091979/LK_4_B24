import type { Role } from "@lk/shared";
import { apiFetch, apiFetchCsrf, apiPostWithCsrf, setAccessToken } from "./http";

export type Me = {
  id: string;
  role: Role;
  bitrixContactId: string;
  allowedDepth: number;
};

let meCache: Me | null = null;

export function getMeCached() {
  return meCache;
}

export async function loadMe() {
  const me = await apiFetch<Me>("/me");
  meCache = me;
  return me;
}

export async function bootstrapSession() {
  // Issue CSRF cookie/token for subsequent refresh/logout.
  await apiFetchCsrf();
  try {
    const r = await apiPostWithCsrf<{ accessToken: string; role: Role; mfaVerified: boolean }>("/auth/refresh");
    setAccessToken(r.accessToken);
    return await loadMe();
  } catch {
    setAccessToken(null);
    meCache = null;
    return null;
  }
}

export async function loginWithPassword(args: { email: string; password: string; captchaToken?: string }) {
  const r = await apiFetch<{ accessToken?: string; mfaRequired?: boolean; mfaSetupRequired?: boolean }>(
    "/auth/login/password",
    { method: "POST", body: JSON.stringify(args) }
  );
  if (r.accessToken) setAccessToken(r.accessToken);
  return r;
}

export async function smsRequest(args: { phone: string; captchaToken?: string }) {
  return apiFetch<{ ok: boolean; error?: string }>("/auth/login/sms/request", {
    method: "POST",
    body: JSON.stringify(args)
  });
}

export async function smsVerify(args: { phone: string; code: string; captchaToken?: string }) {
  const r = await apiFetch<{ accessToken?: string; mfaRequired?: boolean; mfaSetupRequired?: boolean }>(
    "/auth/login/sms/verify",
    { method: "POST", body: JSON.stringify(args) }
  );
  if (r.accessToken) setAccessToken(r.accessToken);
  return r;
}

export async function logout() {
  await apiPostWithCsrf("/auth/logout");
  setAccessToken(null);
  meCache = null;
}

export async function mfaSetup() {
  return apiFetch<{ otpauth: string; secretBase32: string }>("/auth/mfa/setup", { method: "POST" });
}

export async function mfaVerify(code: string) {
  const r = await apiFetch<{ accessToken: string; mfaVerified: boolean }>("/auth/mfa/verify", {
    method: "POST",
    body: JSON.stringify({ code })
  });
  setAccessToken(r.accessToken);
  return r;
}



