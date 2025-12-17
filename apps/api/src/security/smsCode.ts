import { randomToken, sha256Base64Url } from "../utils/crypto.js";

export function generateSmsCode() {
  // 6 digits
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashSmsCode(code: string) {
  const salt = randomToken(12);
  const hash = sha256Base64Url(`${code}:${salt}`);
  return `${salt}:${hash}`;
}

export function verifySmsCode(stored: string, code: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = sha256Base64Url(`${code}:${salt}`);
  return check === hash;
}


