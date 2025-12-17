import { config } from "../config";
import { demoGetRole, demoIsAuthed, demoSetAuthed, isStandaloneMode } from "./standalone";

export class ApiError extends Error {
  constructor(
    public status: number,
    public payload: any
  ) {
    super(payload?.message ?? payload?.error ?? `HTTP ${status}`);
  }
}

let accessToken: string | null = null;
let csrfToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export function getCsrfToken() {
  return csrfToken;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (isStandaloneMode()) {
    return mockApiFetch<T>(path, init);
  }
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include"
  });
  const text = await res.text();
  const payload = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(res.status, payload);
  return payload as T;
}

export async function apiFetchCsrf() {
  const r = await apiFetch<{ csrfToken: string }>("/auth/csrf");
  setCsrfToken(r.csrfToken);
  return r.csrfToken;
}

export async function apiPostWithCsrf<T>(path: string, body?: any): Promise<T> {
  if (!csrfToken) await apiFetchCsrf();
  return apiFetch<T>(path, {
    method: "POST",
    headers: { "x-csrf-token": csrfToken! },
    body: body ? JSON.stringify(body) : undefined
  });
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

// ===== Standalone demo (no backend) =====
async function mockApiFetch<T>(path: string, init: RequestInit): Promise<T> {
  // Very small “fake backend” for MVP demo in browser from local folder.
  const method = (init.method ?? "GET").toUpperCase();
  const body = init.body ? safeJson(String(init.body)) : null;

  // Auth endpoints
  if (path === "/auth/csrf" && method === "GET") return { csrfToken: "demo-csrf" } as T;

  if (path === "/auth/refresh" && method === "POST") {
    if (!demoIsAuthed()) throw new ApiError(401, { error: "INVALID_SESSION" });
    return { accessToken: "demo-access", role: demoGetRole(), mfaVerified: true } as T;
  }

  if (path === "/auth/logout" && method === "POST") {
    demoSetAuthed(false);
    return { ok: true } as T;
  }

  if (path === "/auth/login/password" && method === "POST") {
    const email = String(body?.email ?? "").toLowerCase();
    const password = String(body?.password ?? "");
    if (email === "admin@demo.local" && password === "Admin1234!") {
      demoSetAuthed(true);
      localStorage.setItem("lk.demo.role", "admin");
      return { accessToken: "demo-access" } as T;
    }
    if (email === "client@demo.local" && password === "Client1234!") {
      demoSetAuthed(true);
      localStorage.setItem("lk.demo.role", "client");
      return { accessToken: "demo-access" } as T;
    }
    throw new ApiError(401, { error: "INVALID_CREDENTIALS", message: "Неверный логин/пароль (demo)" });
  }

  if (path === "/auth/login/sms/request" && method === "POST") {
    return { ok: true } as T;
  }

  if (path === "/auth/login/sms/verify" && method === "POST") {
    // accept any 6 digits in demo
    const code = String(body?.code ?? "");
    if (!/^\d{4,8}$/.test(code)) throw new ApiError(401, { error: "INVALID_CODE" });
    demoSetAuthed(true);
    localStorage.setItem("lk.demo.role", "client");
    return { accessToken: "demo-access" } as T;
  }

  // Me endpoints
  if (path === "/me" && method === "GET") {
    if (!demoIsAuthed()) throw new ApiError(401, { error: "UNAUTHORIZED" });
    const role = demoGetRole();
    return {
      id: role === "admin" ? "demo-admin" : "demo-client",
      role,
      bitrixContactId: role === "admin" ? "1000" : "2000",
      allowedDepth: role === "admin" ? 99 : 1
    } as T;
  }

  if (path === "/me/summary" && method === "GET") {
    if (!demoIsAuthed()) throw new ApiError(401, { error: "UNAUTHORIZED" });
    return {
      directRecommendationsCount: 2,
      totalReward: { currency: "RUB", amount: 20000 }
    } as T;
  }

  if (path.startsWith("/me/recommendations") && method === "GET") {
    if (!demoIsAuthed()) throw new ApiError(401, { error: "UNAUTHORIZED" });
    const url = new URL(`http://demo${path}`);
    const depth = Number(url.searchParams.get("depth") ?? "1");
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
    const maxDepth = demoGetRole() === "admin" ? depth : Math.min(depth, 1);

    const all = [
      {
        referredBitrixContactId: "2001",
        fullName: "Рекомендация 1",
        contractId: "demo-contract-1",
        contractDate: "2025-01-10T00:00:00.000Z",
        reward: { currency: "RUB", amount: 15000 },
        status: "active",
        depth: 1,
        path: ["2000", "2001"]
      },
      {
        referredBitrixContactId: "2002",
        fullName: "Рекомендация 2",
        contractId: "demo-contract-2",
        contractDate: "2025-02-01T00:00:00.000Z",
        reward: { currency: "RUB", amount: 5000 },
        status: "inactive",
        depth: 1,
        path: ["2000", "2002"]
      },
      {
        referredBitrixContactId: "2003",
        fullName: "Рекомендация 1-1",
        contractId: "demo-contract-3",
        contractDate: "2025-03-05T00:00:00.000Z",
        reward: { currency: "RUB", amount: 7000 },
        status: "active",
        depth: 2,
        path: ["2000", "2001", "2003"]
      }
    ].filter((x) => x.depth <= maxDepth);

    const total = all.length;
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize);
    return { items, page, pageSize, total } as T;
  }

  if (path.startsWith("/me/contracts/") && method === "GET") {
    if (!demoIsAuthed()) throw new ApiError(401, { error: "UNAUTHORIZED" });
    const id = path.split("/").pop()!;
    const map: Record<string, any> = {
      "demo-contract-1": { id, referredBitrixId: "2001", contractDate: "2025-01-10T00:00:00.000Z", reward: { currency: "RUB", amount: 15000 }, status: "active" },
      "demo-contract-2": { id, referredBitrixId: "2002", contractDate: "2025-02-01T00:00:00.000Z", reward: { currency: "RUB", amount: 5000 }, status: "inactive" },
      "demo-contract-3": { id, referredBitrixId: "2003", contractDate: "2025-03-05T00:00:00.000Z", reward: { currency: "RUB", amount: 7000 }, status: "active" }
    };
    if (!map[id]) throw new ApiError(404, { error: "NOT_FOUND" });
    return map[id] as T;
  }

  // Admin pages can still open in demo-mode, but we keep it minimal.
  if (path.startsWith("/admin") && method === "GET") {
    if (!demoIsAuthed() || demoGetRole() !== "admin") throw new ApiError(403, { error: "FORBIDDEN" });
    if (path.startsWith("/admin/audit")) return { items: [], page: 1, pageSize: 50, total: 0 } as T;
    if (path.startsWith("/admin/users")) return { items: [], page: 1, pageSize: 20, total: 0 } as T;
    if (path.startsWith("/admin/recommendations/children")) return { items: [] } as T;
  }

  throw new ApiError(404, { error: "NOT_FOUND", message: `Standalone: no route for ${method} ${path}` });
}


