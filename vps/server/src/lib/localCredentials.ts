import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { env } from "../config/env.js";
import { ensureLocalDatabaseSchema, getPostgresPool, hasLocalDatabase } from "./postgres.js";

const scrypt = promisify(scryptCallback);

export type LocalCredentialRow = {
  user_id: string;
  email: string | null;
  password_hash: string;
  password_salt: string;
  password_algorithm: string;
  password_updated_at: string;
  created_at: string;
  updated_at: string;
  migrated_from: string;
};

export type LocalRefreshTokenRow = {
  token_id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  replaced_by_token_id: string | null;
};

export type LocalRefreshTokenActivityRow = {
  userId: string;
  lastActivityAt: string | null;
};

type IssueLocalRefreshTokenResult = {
  refreshToken: string;
  expiresAt: number;
  expiresIn: number;
};

type RotateLocalRefreshTokenResult =
  | {
      userId: string;
      refreshToken: string;
      expiresAt: number;
      expiresIn: number;
      reuseDetected?: false;
    }
  | {
      userId: string;
      refreshToken: null;
      expiresAt: null;
      expiresIn: null;
      reuseDetected: true;
    };

const nowIso = () => new Date().toISOString();
const nowSeconds = () => Math.floor(Date.now() / 1000);
const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() || null;

const passwordHashBuffer = async (password: string, salt: string) => {
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return Buffer.from(derivedKey);
};

const hashRefreshToken = (token: string) =>
  createHmac("sha256", env.jwtRefreshSecret || "change_me_refresh_secret").update(token, "utf8").digest("hex");

export const upsertLocalPasswordCredential = async ({
  userId,
  email,
  password,
  migratedFrom = "vps",
}: {
  userId: string;
  email?: string | null;
  password: string;
  migratedFrom?: string;
}) => {
  if (!hasLocalDatabase() || !userId || !password) return null;

  await ensureLocalDatabaseSchema();

  const salt = randomBytes(16).toString("base64url");
  const hash = (await passwordHashBuffer(password, salt)).toString("base64url");
  const timestamp = nowIso();

  const { rows } = await getPostgresPool().query<LocalCredentialRow>(
    [
      "INSERT INTO auth_local_credentials",
      "(user_id, email, password_hash, password_salt, password_algorithm, password_updated_at, created_at, updated_at, migrated_from)",
      "VALUES ($1, $2, $3, $4, 'scrypt', $5, COALESCE((SELECT created_at FROM auth_local_credentials WHERE user_id = $1), $5), $5, $6)",
      "ON CONFLICT (user_id) DO UPDATE SET",
      "email = EXCLUDED.email,",
      "password_hash = EXCLUDED.password_hash,",
      "password_salt = EXCLUDED.password_salt,",
      "password_algorithm = EXCLUDED.password_algorithm,",
      "password_updated_at = EXCLUDED.password_updated_at,",
      "updated_at = EXCLUDED.updated_at,",
      "migrated_from = EXCLUDED.migrated_from",
      "RETURNING user_id, email, password_hash, password_salt, password_algorithm, password_updated_at, created_at, updated_at, migrated_from",
    ].join(" "),
    [userId, normalizeEmail(email), hash, salt, timestamp, migratedFrom]
  );

  return rows[0] ?? null;
};

export const getLocalCredentialByUserId = async (userId: string) => {
  if (!hasLocalDatabase() || !userId) return null;

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<LocalCredentialRow>(
    [
      "SELECT user_id, email, password_hash, password_salt, password_algorithm, password_updated_at, created_at, updated_at, migrated_from",
      "FROM auth_local_credentials WHERE user_id = $1 LIMIT 1",
    ].join(" "),
    [userId]
  );

  return rows[0] ?? null;
};

export const verifyLocalPasswordCredential = async ({
  userId,
  password,
}: {
  userId: string;
  password: string;
}) => {
  const credential = await getLocalCredentialByUserId(userId);
  if (!credential || credential.password_algorithm !== "scrypt") {
    return null;
  }

  const providedHash = await passwordHashBuffer(password, credential.password_salt);
  const storedHash = Buffer.from(credential.password_hash, "base64url");
  if (storedHash.length !== providedHash.length || !timingSafeEqual(storedHash, providedHash)) {
    return null;
  }

  return credential;
};

export const issueLocalRefreshToken = async (userId: string): Promise<IssueLocalRefreshTokenResult | null> => {
  if (!hasLocalDatabase() || !userId) return null;

  await ensureLocalDatabaseSchema();

  const refreshToken = `rt_${randomBytes(48).toString("base64url")}`;
  const expiresIn = env.jwtRefreshExpiresSeconds;
  const expiresAt = nowSeconds() + expiresIn;

  await getPostgresPool().query(
    [
      "INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at)",
      "VALUES ($1, $2, to_timestamp($3))",
    ].join(" "),
    [userId, hashRefreshToken(refreshToken), expiresAt]
  );

  return {
    refreshToken,
    expiresAt,
    expiresIn,
  };
};

export const revokeAllLocalRefreshTokensForUser = async (userId: string) => {
  if (!hasLocalDatabase() || !userId) return 0;

  await ensureLocalDatabaseSchema();
  const { rowCount } = await getPostgresPool().query(
    [
      "UPDATE auth_refresh_tokens",
      "SET revoked_at = COALESCE(revoked_at, now())",
      "WHERE user_id = $1 AND revoked_at IS NULL",
    ].join(" "),
    [userId]
  );

  return rowCount ?? 0;
};

export const rotateLocalRefreshToken = async (refreshToken: string): Promise<RotateLocalRefreshTokenResult | null> => {
  if (!hasLocalDatabase() || !refreshToken) return null;

  await ensureLocalDatabaseSchema();
  const client = await getPostgresPool().connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query<LocalRefreshTokenRow>(
      [
        "SELECT token_id, user_id, token_hash, expires_at, created_at, last_used_at, revoked_at, replaced_by_token_id",
        "FROM auth_refresh_tokens WHERE token_hash = $1 FOR UPDATE",
      ].join(" "),
      [hashRefreshToken(refreshToken)]
    );

    const currentRow = rows[0];
    if (!currentRow) {
      await client.query("ROLLBACK");
      return null;
    }

    if (currentRow.revoked_at || new Date(currentRow.expires_at).getTime() <= Date.now()) {
      const reuseDetected = Boolean(currentRow.revoked_at && currentRow.replaced_by_token_id);
      if (reuseDetected) {
        await client.query(
          [
            "UPDATE auth_refresh_tokens",
            "SET revoked_at = COALESCE(revoked_at, now())",
            "WHERE user_id = $1 AND revoked_at IS NULL",
          ].join(" "),
          [currentRow.user_id]
        );
        await client.query("COMMIT");
        return {
          userId: currentRow.user_id,
          refreshToken: null,
          expiresAt: null,
          expiresIn: null,
          reuseDetected: true,
        };
      }

      await client.query("ROLLBACK");
      return null;
    }

    const nextRefreshToken = `rt_${randomBytes(48).toString("base64url")}`;
    const expiresIn = env.jwtRefreshExpiresSeconds;
    const expiresAt = nowSeconds() + expiresIn;

    const { rows: insertedRows } = await client.query<{ token_id: string }>(
      [
        "INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at)",
        "VALUES ($1, $2, to_timestamp($3))",
        "RETURNING token_id",
      ].join(" "),
      [currentRow.user_id, hashRefreshToken(nextRefreshToken), expiresAt]
    );

    const replacementTokenId = insertedRows[0]?.token_id ?? null;
    await client.query(
      [
        "UPDATE auth_refresh_tokens",
        "SET revoked_at = now(), last_used_at = now(), replaced_by_token_id = $2",
        "WHERE token_id = $1",
      ].join(" "),
      [currentRow.token_id, replacementTokenId]
    );

    await client.query("COMMIT");

    return {
      userId: currentRow.user_id,
      refreshToken: nextRefreshToken,
      expiresAt,
      expiresIn,
      reuseDetected: false,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => null);
    throw error;
  } finally {
    client.release();
  }
};

export const listLocalRefreshTokenActivityByUserIds = async (
  userIds: string[]
): Promise<LocalRefreshTokenActivityRow[]> => {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!hasLocalDatabase() || uniqueUserIds.length === 0) return [];

  await ensureLocalDatabaseSchema();

  const { rows } = await getPostgresPool().query<{
    user_id: string;
    last_activity_at: string | null;
  }>(
    [
      "SELECT user_id, MAX(COALESCE(last_used_at, created_at))::text AS last_activity_at",
      "FROM auth_refresh_tokens",
      "WHERE user_id = ANY($1::text[])",
      "GROUP BY user_id",
    ].join(" "),
    [uniqueUserIds]
  );

  return rows.map((row) => ({
    userId: row.user_id,
    lastActivityAt: row.last_activity_at,
  }));
};

export const revokeLocalRefreshToken = async (refreshToken?: string | null) => {
  if (!hasLocalDatabase() || !refreshToken) return false;

  await ensureLocalDatabaseSchema();
  const { rowCount } = await getPostgresPool().query(
    [
      "UPDATE auth_refresh_tokens",
      "SET revoked_at = COALESCE(revoked_at, now())",
      "WHERE token_hash = $1 AND revoked_at IS NULL",
    ].join(" "),
    [hashRefreshToken(refreshToken)]
  );

  return Boolean(rowCount);
};

export const deleteLocalCredentialArtifactsByUserId = async (userId: string) => {
  if (!hasLocalDatabase() || !userId) return;

  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM auth_refresh_tokens WHERE user_id = $1", [userId]);
  await getPostgresPool().query("DELETE FROM auth_password_reset_tokens WHERE user_id = $1", [userId]);
  await getPostgresPool().query("DELETE FROM auth_email_confirmation_tokens WHERE user_id = $1", [userId]);
  await getPostgresPool().query("DELETE FROM auth_local_credentials WHERE user_id = $1", [userId]);
};
