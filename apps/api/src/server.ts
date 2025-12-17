import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, getConfig } from "./config.js";
import { authRoutes } from "./routes/auth.js";
import { StubSmsProvider } from "./integrations/sms/smsProvider.js";
import { BitrixService } from "./integrations/bitrix/bitrixService.js";
import { MockBitrixClient, RealBitrixClient } from "./integrations/bitrix/bitrixClient.js";
import { ReferralService } from "./domain/referrals/referralService.js";
import { meRoutes } from "./routes/me.js";
import { adminRoutes } from "./routes/admin.js";
import { BitrixSyncService } from "./integrations/bitrix/syncService.js";
import { createStorage } from "./storage/factory.js";
import { setupRoutes } from "./routes/setup.js";

loadEnv();
const config = getConfig();

const app = Fastify({
  logger: {
    level: config.NODE_ENV === "development" ? "info" : "warn"
  },
  trustProxy: true
});

app.decorate("config", config);
const storage = createStorage(config);
await storage.init();
app.decorate("storage", storage);
app.decorate("smsProvider", new StubSmsProvider());
const bitrixClient =
  config.BITRIX_MODE === "real" && config.BITRIX_BASE_URL && config.BITRIX_WEBHOOK_PATH
    ? new RealBitrixClient({ baseUrl: config.BITRIX_BASE_URL, webhookPath: config.BITRIX_WEBHOOK_PATH })
    : new MockBitrixClient();
const bitrix = new BitrixService(bitrixClient);
app.decorate("bitrix", bitrix);
app.decorate("referrals", new ReferralService(bitrix, storage));
app.decorate("bitrixSync", new BitrixSyncService({ config, client: bitrixClient, storage }));

await app.register(cookie);
await app.register(cors, {
  origin: config.NODE_ENV === "development" ? config.API_PUBLIC_ORIGIN : false,
  credentials: true
});
await app.register(helmet);
await app.register(rateLimit, {
  max: 120,
  timeWindow: "1 minute",
  keyGenerator: (req) => req.ip
});
await app.register(jwt, { secret: config.JWT_ACCESS_SECRET });

await app.register(swagger, {
  openapi: {
    info: { title: "LK API", version: "0.0.1" },
    servers: [{ url: `http://${config.API_HOST}:${config.API_PORT}` }]
  }
});
await app.register(swaggerUi, { routePrefix: "/docs" });

app.setErrorHandler(async (err, request, reply) => {
  request.log.error({ err }, "Unhandled error");
  const status = reply.statusCode >= 400 ? reply.statusCode : 500;
  reply.code(status);
  return {
    error: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "INTERNAL_ERROR",
    message: config.NODE_ENV === "development" ? err.message : "Request failed",
    requestId: request.id
  };
});

app.get("/health", async () => ({ ok: true }));
await app.register(authRoutes, { prefix: "/auth" });
await app.register(setupRoutes, { prefix: "/setup" });
await app.register(meRoutes, { prefix: "/me" });
await app.register(adminRoutes, { prefix: "/admin" });

// In production we serve the web app (SPA) from the same origin to keep secure cookies simple.
if (config.NODE_ENV !== "development") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // When running compiled code: apps/api/dist/server.js -> web dist is ../../web/dist
  const webDist = path.resolve(__dirname, "../../web/dist");
  await app.register(fastifyStatic, {
    root: webDist,
    prefix: "/"
  });
  // SPA fallback (avoid overriding API routes)
  app.get("/*", async (req, reply) => {
    if (req.url.startsWith("/auth") || req.url.startsWith("/setup") || req.url.startsWith("/me") || req.url.startsWith("/admin") || req.url.startsWith("/docs") || req.url.startsWith("/health")) {
      reply.code(404);
      return { error: "NOT_FOUND" };
    }
    return reply.sendFile("index.html");
  });
}

await app.listen({ host: config.API_HOST, port: config.PORT ?? config.API_PORT });


