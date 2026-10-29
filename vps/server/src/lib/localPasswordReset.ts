import { createHmac, randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import { ensureLocalDatabaseSchema, getPostgresPool, hasLocalDatabase } from "./postgres.js";

export type LocalPasswordResetTokenRow = {
  token_id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  consumed_at: string | null;
};

const hashResetToken = (token: string) =>
  createHmac("sha256", env.jwtRefreshSecret || env.jwtAccessSecret || "change_me_reset_secret")
    .update(token, "utf8")
    .digest("hex");

const toValidRow = (row?: LocalPasswordResetTokenRow | null) => {
  if (!row || row.consumed_at) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row;
};

export const issueLocalPasswordResetToken = async (userId: string) => {
  if (!hasLocalDatabase() || !userId) return null;

  await ensureLocalDatabaseSchema();

  const token = `prt_${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + Math.max(env.passwordResetTokenExpiresMinutes || 60, 1) * 60 * 1000);

  await getPostgresPool().query(
    [
      "INSERT INTO auth_password_reset_tokens (user_id, token_hash, expires_at)",
      "VALUES ($1, $2, $3)",
    ].join(" "),
    [userId, hashResetToken(token), expiresAt.toISOString()]
  );

  return token;
};

export const getLocalPasswordResetToken = async (token: string) => {
  if (!hasLocalDatabase() || !token) return null;

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<LocalPasswordResetTokenRow>(
    [
      "SELECT token_id, user_id, token_hash, expires_at, created_at, consumed_at",
      "FROM auth_password_reset_tokens WHERE token_hash = $1 LIMIT 1",
    ].join(" "),
    [hashResetToken(token)]
  );

  return toValidRow(rows[0]);
};

export const consumeLocalPasswordResetToken = async (token: string) => {
  if (!hasLocalDatabase() || !token) return null;

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<LocalPasswordResetTokenRow>(
    [
      "UPDATE auth_password_reset_tokens",
      "SET consumed_at = now()",
      "WHERE token_hash = $1",
      "AND consumed_at IS NULL",
      "AND expires_at > now()",
      "RETURNING token_id, user_id, token_hash, expires_at, created_at, consumed_at",
    ].join(" "),
    [hashResetToken(token)]
  );

  return rows[0] ?? null;
};
