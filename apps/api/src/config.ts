import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

function loadEnvFileIfExists(filePath: string) {
  try {
    if (fs.existsSync(filePath)) dotenv.config({ path: filePath, override: true });
  } catch {
    // ignore
  }
}

export function loadEnv() {
  // Order: process.env (already set) <- .env <- env.local
  const cwd = process.cwd();
  loadEnvFileIfExists(path.join(cwd, ".env"));
  loadEnvFileIfExists(path.join(cwd, "env.local"));
}

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().default(8080),
  PORT: z.coerce.number().int().optional(),
  API_PUBLIC_ORIGIN: z.string().url().default("http://localhost:5173"),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().default(60 * 60 * 24 * 30),

  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("strict"),

  DATABASE_URL: z.string().min(1),

  BITRIX_MODE: z.enum(["mock", "real"]).default("mock"),
  BITRIX_BASE_URL: z.string().url().optional(),
  BITRIX_WEBHOOK_PATH: z.string().optional(),
  BITRIX_REFERRER_FIELD: z.string().default("UF_CRM_REFERRER_ID"),
  BITRIX_DEAL_REWARD_FIELD: z.string().default("UF_CRM_REWARD_AMOUNT"),
  BITRIX_DEAL_DATE_FIELD: z.string().default("CLOSEDATE"),

  SMS_PROVIDER: z.enum(["stub"]).default("stub"),

  APP_ENC_KEY_BASE64: z.string().optional().default("")
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function getConfig(): AppConfig {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(parsed.error.format());
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}


