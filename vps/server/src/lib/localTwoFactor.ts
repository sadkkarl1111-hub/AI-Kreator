import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { ensureLocalDatabaseSchema, getPostgresPool, hasLocalDatabase } from "./postgres.js";

export type TotpRow = {
  user_id: string;
  secret_encrypted: string;
  enabled_at: string;
  last_used_step: string | number | null;
  created_at: string;
  updated_at: string;
};

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

const getEncryptionKey = () =>
  createHash("sha256")
    .update(env.jwtRefreshSecret || env.jwtAccessSecret || "change_me_totp_secret", "utf8")
    .digest();

const encryptSecret = (secret: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
};

const decryptSecret = (payload: string) => {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(":");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Nieprawidlowy format sekretu 2FA.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

export const generateTotpSecret = () => {
  const bytes = randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");

  let output = "";
  for (let index = 0; index + 5 <= bits.length; index += 5) {
    output += BASE32_ALPHABET[Number.parseInt(bits.slice(index, index + 5), 2)];
  }

  return output;
};

const decodeBase32 = (value: string) => {
  const clean = value.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Nieprawidlowy sekret 2FA.");
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
};

const hotp = (secret: string, counter: number) => {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) %
    10 ** TOTP_DIGITS;

  return String(code).padStart(TOTP_DIGITS, "0");
};

const normalizeCode = (value: string) => value.replace(/\s+/g, "").trim();
const normalizeRecoveryCode = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
const RECOVERY_CODE_COUNT = 10;

const hashRecoveryCode = (userId: string, code: string) =>
  createHmac("sha256", env.jwtRefreshSecret || env.jwtAccessSecret || "change_me_recovery_codes_secret")
    .update(`${userId}:${normalizeRecoveryCode(code)}`, "utf8")
    .digest("hex");

const generateRecoveryCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  let raw = "";
  for (const byte of bytes) raw += alphabet[byte % alphabet.length];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`;
};

export const buildTotpUri = ({ secret, email }: { secret: string; email: string | null }) => {
  const issuer = "Kreator Grafik AI";
  const label = `${issuer}:${email || "admin"}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
};

export const verifyTotpCode = (secret: string, code: string, options: { lastUsedStep?: number | null } = {}) => {
  const normalizedCode = normalizeCode(code);
  if (!/^\d{6}$/.test(normalizedCode)) return { ok: false, step: null };

  const currentStep = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  for (const delta of [-1, 0, 1]) {
    const step = currentStep + delta;
    if (options.lastUsedStep != null && step <= options.lastUsedStep) continue;

    const expected = hotp(secret, step);
    const expectedBuffer = Buffer.from(expected, "utf8");
    const providedBuffer = Buffer.from(normalizedCode, "utf8");
    if (providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer)) {
      return { ok: true, step };
    }
  }

  return { ok: false, step: null };
};

export const getLocalUserTotp = async (userId: string) => {
  if (!hasLocalDatabase() || !userId) return null;

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<TotpRow>(
    [
      "SELECT user_id, secret_encrypted, enabled_at, last_used_step, created_at, updated_at",
      "FROM auth_user_totp WHERE user_id = $1 LIMIT 1",
    ].join(" "),
    [userId]
  );

  return rows[0] ?? null;
};

export const isLocalUserTotpEnabled = async (userId: string) => Boolean(await getLocalUserTotp(userId));

export const enableLocalUserTotp = async (userId: string, secret: string, usedStep: number | null) => {
  if (!hasLocalDatabase() || !userId || !secret) return null;

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<TotpRow>(
    [
      "INSERT INTO auth_user_totp (user_id, secret_encrypted, last_used_step)",
      "VALUES ($1, $2, $3)",
      "ON CONFLICT (user_id) DO UPDATE SET",
      "secret_encrypted = EXCLUDED.secret_encrypted,",
      "enabled_at = now(),",
      "last_used_step = EXCLUDED.last_used_step,",
      "updated_at = now()",
      "RETURNING user_id, secret_encrypted, enabled_at, last_used_step, created_at, updated_at",
    ].join(" "),
    [userId, encryptSecret(secret), usedStep]
  );

  return rows[0] ?? null;
};

export const verifyLocalUserTotp = async (userId: string, code: string, options: { markUsed?: boolean } = {}) => {
  const row = await getLocalUserTotp(userId);
  if (!row) return false;

  const lastUsedStep = row.last_used_step == null ? null : Number(row.last_used_step);
  const result = verifyTotpCode(decryptSecret(row.secret_encrypted), code, { lastUsedStep });
  if (!result.ok || result.step == null) return false;

  if (options.markUsed !== false) {
    await getPostgresPool().query(
      "UPDATE auth_user_totp SET last_used_step = $2, updated_at = now() WHERE user_id = $1",
      [userId, result.step]
    );
  }

  return true;
};

export const disableLocalUserTotp = async (userId: string) => {
  if (!hasLocalDatabase() || !userId) return;

  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM auth_user_totp WHERE user_id = $1", [userId]);
  await getPostgresPool().query("DELETE FROM auth_user_recovery_codes WHERE user_id = $1", [userId]);
};

export const replaceLocalUserRecoveryCodes = async (userId: string, count = RECOVERY_CODE_COUNT) => {
  if (!hasLocalDatabase() || !userId) return [];

  await ensureLocalDatabaseSchema();
  const codes = Array.from({ length: count }, () => generateRecoveryCode());
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM auth_user_recovery_codes WHERE user_id = $1", [userId]);
    for (const code of codes) {
      await client.query(
        "INSERT INTO auth_user_recovery_codes (user_id, code_hash) VALUES ($1, $2)",
        [userId, hashRecoveryCode(userId, code)]
      );
    }
    await client.query("COMMIT");
    return codes;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const countLocalUserRecoveryCodes = async (userId: string) => {
  if (!hasLocalDatabase() || !userId) return { total: 0, unused: 0 };

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<{ total: string; unused: string }>(
    [
      "SELECT COUNT(*)::text AS total,",
      "COUNT(*) FILTER (WHERE used_at IS NULL)::text AS unused",
      "FROM auth_user_recovery_codes WHERE user_id = $1",
    ].join(" "),
    [userId]
  );

  return {
    total: Number(rows[0]?.total ?? 0),
    unused: Number(rows[0]?.unused ?? 0),
  };
};

export const consumeLocalUserRecoveryCode = async (userId: string, code: string) => {
  if (!hasLocalDatabase() || !userId || !code) return false;

  const normalizedCode = normalizeRecoveryCode(code);
  if (normalizedCode.length < 8) return false;

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<{ id: string }>(
    [
      "UPDATE auth_user_recovery_codes",
      "SET used_at = now()",
      "WHERE id = (",
      "SELECT id FROM auth_user_recovery_codes",
      "WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL",
      "ORDER BY created_at ASC LIMIT 1",
      ")",
      "RETURNING id",
    ].join(" "),
    [userId, hashRecoveryCode(userId, normalizedCode)]
  );

  return Boolean(rows[0]?.id);
};
