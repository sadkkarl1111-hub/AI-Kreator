import { createHmac, randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import { ensureLocalDatabaseSchema, getPostgresPool, hasLocalDatabase } from "./postgres.js";

export type LocalEmailConfirmationTokenRow = {
  token_id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  consumed_at: string | null;
};

const hashEmailConfirmationToken = (token: string) =>
  createHmac("sha256", env.jwtRefreshSecret || env.jwtAccessSecret || "change_me_email_confirmation_secret")
    .update(token, "utf8")
    .digest("hex");

export const issueLocalEmailConfirmationToken = async (userId: string) => {
  if (!hasLocalDatabase() || !userId) return null;

  await ensureLocalDatabaseSchema();

  const token = `ect_${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await getPostgresPool().query(
    [
      "INSERT INTO auth_email_confirmation_tokens (user_id, token_hash, expires_at)",
      "VALUES ($1, $2, $3)",
    ].join(" "),
    [userId, hashEmailConfirmationToken(token), expiresAt.toISOString()]
  );

  return token;
};

export const consumeLocalEmailConfirmationToken = async (token: string) => {
  if (!hasLocalDatabase() || !token) return null;

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<LocalEmailConfirmationTokenRow>(
    [
      "UPDATE auth_email_confirmation_tokens",
      "SET consumed_at = now()",
      "WHERE token_hash = $1",
      "AND consumed_at IS NULL",
      "AND expires_at > now()",
      "RETURNING token_id, user_id, token_hash, expires_at, created_at, consumed_at",
    ].join(" "),
    [hashEmailConfirmationToken(token)]
  );

  return rows[0] ?? null;
};

export const confirmLocalUserEmail = async (userId: string) => {
  if (!hasLocalDatabase() || !userId) return null;

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<{ user_id: string; email_confirmed_at: string }>(
    [
      "UPDATE auth_users",
      "SET email_confirmed_at = COALESCE(email_confirmed_at, now()), updated_at = now()",
      "WHERE user_id = $1",
      "RETURNING user_id, email_confirmed_at",
    ].join(" "),
    [userId]
  );

  return rows[0] ?? null;
};
