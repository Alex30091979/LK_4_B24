import crypto from "node:crypto";

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256Base64Url(input: string) {
  return crypto.createHash("sha256").update(input).digest("base64url");
}

export function timingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function aes256gcmEncrypt(plaintext: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length < 32) throw new Error("APP_ENC_KEY_BASE64 must be >= 32 bytes");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key.subarray(0, 32), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function aes256gcmDecrypt(ciphertext: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length < 32) throw new Error("APP_ENC_KEY_BASE64 must be >= 32 bytes");
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Invalid ciphertext format");
  const iv = Buffer.from(parts[1]!, "base64url");
  const tag = Buffer.from(parts[2]!, "base64url");
  const data = Buffer.from(parts[3]!, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key.subarray(0, 32), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}


