import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifyPassword } from "../security/password.js";
import { getLockout, registerAuthFailure, registerAuthSuccess } from "../security/lockout.js";
import { issueCsrfToken, requireCsrf } from "../security/csrf.js";
import { createSessionAndTokens, REFRESH_COOKIE_NAME, rotateRefreshToken } from "../security/tokens.js";
import { getSessionFromRefreshCookie } from "../security/sessionFromRefresh.js";
import { generateSmsCode, hashSmsCode, verifySmsCode } from "../security/smsCode.js";
import { writeAudit } from "../audit.js";
import { authenticator } from "otplib";
import { aes256gcmDecrypt, aes256gcmEncrypt } from "../utils/crypto.js";
import { isCaptchaRequired, verifyCaptcha } from "../security/captcha.js";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.get("/csrf", async (request, reply) => {
    const token = issueCsrfToken(reply, {
      secure: fastify.config.COOKIE_SECURE,
      sameSite: fastify.config.COOKIE_SAMESITE
    });
    await writeAudit({ request, action: "auth.csrf_issued" });
    return { csrfToken: token };
  });

  fastify.post("/login/password", async (request, reply) => {
    const Body = z.object({ email: z.string().email(), password: z.string().min(1), captchaToken: z.string().optional() });
    const { email, password, captchaToken } = Body.parse(request.body);

    const key = `email:${email.toLowerCase()}`;
    if (await isCaptchaRequired(fastify.storage, key)) {
      if (!captchaToken || !(await verifyCaptcha({ token: captchaToken, ip: request.ip }))) {
        await writeAudit({ request, action: "auth.captcha.required", data: { key } });
        reply.code(400);
        return { error: "CAPTCHA_REQUIRED" };
      }
    }
    const blockedUntil = await getLockout(fastify.storage, key);
    if (blockedUntil) {
      await writeAudit({ request, action: "auth.login.blocked", data: { key, blockedUntil } });
      reply.header("Retry-After", Math.ceil((blockedUntil.getTime() - Date.now()) / 1000));
      reply.code(429);
      return { error: "LOCKED", blockedUntil: blockedUntil.toISOString() };
    }

    const user = await fastify.storage.userFindByEmail(email.toLowerCase());
    const ok = !!user?.passwordHash && (await verifyPassword(user.passwordHash, password));

    if (!ok || !user || !user.isActive) {
      const { blockedUntil: until, retryAfterMs } = await registerAuthFailure(fastify.storage, key);
      await writeAudit({ request, action: "auth.login.failed", data: { key, retryAfterMs, until } });
      reply.header("Retry-After", Math.ceil(retryAfterMs / 1000));
      reply.code(401);
      return { error: "INVALID_CREDENTIALS", retryAfterMs, blockedUntil: until?.toISOString() ?? null };
    }

    await registerAuthSuccess(fastify.storage, key);
    const totp = user.role === "admin" ? await fastify.storage.totpFindByUserId(user.id) : null;
    const mfaEnabled = !!totp?.enabled;
    const mfaSetupRequired = user.role === "admin" && !mfaEnabled;
    const mfaRequired = user.role === "admin" && mfaEnabled;

    const { accessToken } = await createSessionAndTokens({
      fastify,
      reply,
      storage: fastify.storage,
      userId: user.id,
      role: user.role,
      mfaVerified: user.role === "admin" ? false : true,
      ip: request.ip,
      userAgent: request.headers["user-agent"] as string | undefined,
      refreshTtlSeconds: fastify.config.JWT_REFRESH_TTL_SECONDS,
      accessTtlSeconds: fastify.config.JWT_ACCESS_TTL_SECONDS,
      cookieSecure: fastify.config.COOKIE_SECURE,
      cookieSameSite: fastify.config.COOKIE_SAMESITE,
      refreshSecret: fastify.config.JWT_REFRESH_SECRET
    });

    issueCsrfToken(reply, { secure: fastify.config.COOKIE_SECURE, sameSite: fastify.config.COOKIE_SAMESITE });
    await writeAudit({ request, userId: user.id, action: "auth.login.success", data: { method: "password" } });

    if (mfaSetupRequired) return { mfaSetupRequired: true };
    if (mfaRequired) return { mfaRequired: true };
    return { accessToken };
  });

  fastify.post("/login/sms/request", async (request, reply) => {
    const Body = z.object({ phone: z.string().min(7).max(32), captchaToken: z.string().optional() });
    const { phone, captchaToken } = Body.parse(request.body);
    const key = `phone:${phone}`;

    if (await isCaptchaRequired(fastify.storage, key)) {
      if (!captchaToken || !(await verifyCaptcha({ token: captchaToken, ip: request.ip }))) {
        await writeAudit({ request, action: "auth.captcha.required", data: { key } });
        reply.code(400);
        return { error: "CAPTCHA_REQUIRED" };
      }
    }

    const blockedUntil = await getLockout(fastify.storage, key);
    if (blockedUntil) {
      await writeAudit({ request, action: "auth.sms_request.blocked", data: { key, blockedUntil } });
      reply.header("Retry-After", Math.ceil((blockedUntil.getTime() - Date.now()) / 1000));
      reply.code(429);
      return { error: "LOCKED", blockedUntil: blockedUntil.toISOString() };
    }

    const code = generateSmsCode();
    const codeHash = hashSmsCode(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await fastify.storage.smsCreate({
      id: `sms_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      phone,
      codeHash,
      createdAt: new Date(),
      expiresAt,
      consumedAt: null,
      attempts: 0,
      maxAttempts: 6,
      blockedUntil: null,
      ip: request.ip ?? null
    });

    await fastify.smsProvider.sendSms({ to: phone, message: `Ваш код входа: ${code}` });
    await writeAudit({ request, action: "auth.sms_request.sent", data: { phone, expiresAt } });

    // Do not reveal whether phone exists to prevent user enumeration.
    return { ok: true };
  });

  fastify.post("/login/sms/verify", async (request, reply) => {
    const Body = z.object({ phone: z.string().min(7).max(32), code: z.string().min(4).max(8), captchaToken: z.string().optional() });
    const { phone, code, captchaToken } = Body.parse(request.body);
    const key = `phone:${phone}`;

    if (await isCaptchaRequired(fastify.storage, key)) {
      if (!captchaToken || !(await verifyCaptcha({ token: captchaToken, ip: request.ip }))) {
        await writeAudit({ request, action: "auth.captcha.required", data: { key } });
        reply.code(400);
        return { error: "CAPTCHA_REQUIRED" };
      }
    }

    const blockedUntil = await getLockout(fastify.storage, key);
    if (blockedUntil) {
      await writeAudit({ request, action: "auth.sms_verify.blocked", data: { key, blockedUntil } });
      reply.header("Retry-After", Math.ceil((blockedUntil.getTime() - Date.now()) / 1000));
      reply.code(429);
      return { error: "LOCKED", blockedUntil: blockedUntil.toISOString() };
    }

    const sms = await fastify.storage.smsFindLatestActive(phone, new Date());

    if (!sms || sms.blockedUntil?.getTime()! > Date.now()) {
      const { blockedUntil: until, retryAfterMs } = await registerAuthFailure(fastify.storage, key);
      await writeAudit({ request, action: "auth.sms_verify.failed", data: { phone, retryAfterMs, until } });
      reply.header("Retry-After", Math.ceil(retryAfterMs / 1000));
      reply.code(401);
      return { error: "INVALID_CODE", retryAfterMs, blockedUntil: until?.toISOString() ?? null };
    }

    if (sms.attempts >= sms.maxAttempts) {
      await fastify.storage.smsUpdate(sms.id, { blockedUntil: new Date(Date.now() + 15 * 60 * 1000) });
      const { blockedUntil: until } = await registerAuthFailure(fastify.storage, key);
      await writeAudit({ request, action: "auth.sms_verify.locked", data: { phone, until } });
      reply.code(429);
      return { error: "LOCKED" };
    }

    const ok = verifySmsCode(sms.codeHash, code);
    await fastify.storage.smsUpdate(sms.id, { attempts: sms.attempts + 1, consumedAt: ok ? new Date() : null });

    if (!ok) {
      const { blockedUntil: until, retryAfterMs } = await registerAuthFailure(fastify.storage, key);
      await writeAudit({ request, action: "auth.sms_verify.failed", data: { phone, retryAfterMs, until } });
      reply.header("Retry-After", Math.ceil(retryAfterMs / 1000));
      reply.code(401);
      return { error: "INVALID_CODE", retryAfterMs, blockedUntil: until?.toISOString() ?? null };
    }

    const user = await fastify.storage.userFindByPhone(phone);
    if (!user || !user.isActive) {
      await writeAudit({ request, action: "auth.sms_verify.no_user", data: { phone } });
      reply.code(403);
      return { error: "USER_NOT_PROVISIONED" };
    }

    await registerAuthSuccess(fastify.storage, key);
    const totp = user.role === "admin" ? await fastify.storage.totpFindByUserId(user.id) : null;
    const mfaEnabled = !!totp?.enabled;
    const mfaSetupRequired = user.role === "admin" && !mfaEnabled;
    const mfaRequired = user.role === "admin" && mfaEnabled;

    const { accessToken } = await createSessionAndTokens({
      fastify,
      reply,
      storage: fastify.storage,
      userId: user.id,
      role: user.role,
      mfaVerified: user.role === "admin" ? false : true,
      ip: request.ip,
      userAgent: request.headers["user-agent"] as string | undefined,
      refreshTtlSeconds: fastify.config.JWT_REFRESH_TTL_SECONDS,
      accessTtlSeconds: fastify.config.JWT_ACCESS_TTL_SECONDS,
      cookieSecure: fastify.config.COOKIE_SECURE,
      cookieSameSite: fastify.config.COOKIE_SAMESITE,
      refreshSecret: fastify.config.JWT_REFRESH_SECRET
    });

    issueCsrfToken(reply, { secure: fastify.config.COOKIE_SECURE, sameSite: fastify.config.COOKIE_SAMESITE });
    await writeAudit({ request, userId: user.id, action: "auth.login.success", data: { method: "sms" } });

    if (mfaSetupRequired) return { mfaSetupRequired: true };
    if (mfaRequired) return { mfaRequired: true };
    return { accessToken };
  });

  fastify.post("/refresh", async (request, reply) => {
    requireCsrf(request, reply);
    const sessionWrap = await getSessionFromRefreshCookie({
      fastify,
      request,
      storage: fastify.storage,
      refreshSecret: fastify.config.JWT_REFRESH_SECRET
    });
    if (!sessionWrap) {
      reply.code(401);
      return { error: "INVALID_SESSION" };
    }

    const user = await fastify.storage.userFindById(sessionWrap.session.userId);
    if (!user || !user.isActive) {
      reply.code(401);
      return { error: "INVALID_SESSION" };
    }

    const { accessToken } = await rotateRefreshToken({
      fastify,
      reply,
      storage: fastify.storage,
      sessionId: sessionWrap.session.id,
      userId: user.id,
      role: user.role,
      mfaVerified: sessionWrap.session.mfaVerified,
      refreshTtlSeconds: fastify.config.JWT_REFRESH_TTL_SECONDS,
      accessTtlSeconds: fastify.config.JWT_ACCESS_TTL_SECONDS,
      cookieSecure: fastify.config.COOKIE_SECURE,
      cookieSameSite: fastify.config.COOKIE_SAMESITE,
      refreshSecret: fastify.config.JWT_REFRESH_SECRET
    });

    await writeAudit({ request, userId: user.id, action: "auth.refresh" });
    return { accessToken, mfaVerified: sessionWrap.session.mfaVerified, role: user.role };
  });

  fastify.post("/logout", async (request, reply) => {
    requireCsrf(request, reply);
    const sessionWrap = await getSessionFromRefreshCookie({
      fastify,
      request,
      storage: fastify.storage,
      refreshSecret: fastify.config.JWT_REFRESH_SECRET
    });
    if (sessionWrap) {
      await fastify.storage.sessionUpdate(sessionWrap.session.id, { revokedAt: new Date() });
      await writeAudit({ request, userId: sessionWrap.session.userId, action: "auth.logout" });
    }
    reply.clearCookie(REFRESH_COOKIE_NAME, { path: "/auth" });
    return { ok: true };
  });

  fastify.post("/mfa/setup", async (request, reply) => {
    const sessionWrap = await getSessionFromRefreshCookie({
      fastify,
      request,
      storage: fastify.storage,
      refreshSecret: fastify.config.JWT_REFRESH_SECRET
    });
    if (!sessionWrap) {
      reply.code(401);
      return { error: "INVALID_SESSION" };
    }

    const user = await fastify.storage.userFindById(sessionWrap.session.userId);
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "FORBIDDEN" };
    }

    const secret = authenticator.generateSecret();
    const encKey = fastify.config.APP_ENC_KEY_BASE64;
    const secretEnc = encKey ? aes256gcmEncrypt(secret, encKey) : secret;

    await fastify.storage.totpUpsert(user.id, secretEnc, false);

    const label = user.email ?? user.phone ?? user.id;
    const issuer = "LK";
    const otpauth = authenticator.keyuri(label, issuer, secret);
    await writeAudit({ request, userId: user.id, action: "auth.mfa.setup" });
    return { otpauth, secretBase32: secret, issuer, label };
  });

  fastify.post("/mfa/verify", async (request, reply) => {
    const Body = z.object({ code: z.string().min(6).max(8) });
    const { code } = Body.parse(request.body);

    const sessionWrap = await getSessionFromRefreshCookie({
      fastify,
      request,
      storage: fastify.storage,
      refreshSecret: fastify.config.JWT_REFRESH_SECRET
    });
    if (!sessionWrap) {
      reply.code(401);
      return { error: "INVALID_SESSION" };
    }

    const user = await fastify.storage.userFindById(sessionWrap.session.userId);
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "FORBIDDEN" };
    }

    const totp = await fastify.storage.totpFindByUserId(user.id);
    if (!totp) {
      reply.code(400);
      return { error: "MFA_NOT_CONFIGURED" };
    }

    const encKey = fastify.config.APP_ENC_KEY_BASE64;
    const secret = encKey ? aes256gcmDecrypt(totp.secretEnc, encKey) : totp.secretEnc;
    const ok = authenticator.check(code, secret);
    if (!ok) {
      await writeAudit({ request, userId: user.id, action: "auth.mfa.verify_failed" });
      reply.code(401);
      return { error: "INVALID_CODE" };
    }

    await fastify.storage.totpUpdate(user.id, { enabled: true });
    await fastify.storage.sessionUpdate(sessionWrap.session.id, { mfaVerified: true });

    const { accessToken } = await rotateRefreshToken({
      fastify,
      reply,
      storage: fastify.storage,
      sessionId: sessionWrap.session.id,
      userId: user.id,
      role: user.role,
      mfaVerified: true,
      refreshTtlSeconds: fastify.config.JWT_REFRESH_TTL_SECONDS,
      accessTtlSeconds: fastify.config.JWT_ACCESS_TTL_SECONDS,
      cookieSecure: fastify.config.COOKIE_SECURE,
      cookieSameSite: fastify.config.COOKIE_SAMESITE,
      refreshSecret: fastify.config.JWT_REFRESH_SECRET
    });

    await writeAudit({ request, userId: user.id, action: "auth.mfa.verified" });
    return { accessToken, mfaVerified: true };
  });
}


