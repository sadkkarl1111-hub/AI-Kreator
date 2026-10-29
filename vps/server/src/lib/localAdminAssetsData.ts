import { randomUUID } from "node:crypto";
import { ensureLocalDatabaseSchema, getPostgresPool, hasLocalDatabase } from "./postgres.js";

export type EmojiCategoryRow = {
  id: string;
  label: string;
  sort_order: number;
  created_at: string;
};

export type AdminEmojiRow = {
  id: string;
  category_id: string;
  emoji: string;
  sort_order: number;
  created_at: string;
};

export type AdminBadgeRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  storage_path: string;
  sort_order: number;
  created_at: string;
};

export type HiddenStaticBadgeRow = {
  badge_key: string;
  created_at: string;
};

export type BadgePackageAccessRow = {
  id: string;
  badge_key: string;
  package_id: string;
  created_at: string;
};

export type FavoriteEmojiRow = {
  id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type ErrorLogRow = {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
};

type LocalErrorLogFilters = {
  source?: string;
  userId?: string;
  limit?: number;
};

type LocalErrorLogInput = {
  source: string;
  message: string;
  stack?: string | null;
  context?: Record<string, unknown> | null;
  userId?: string | null;
};

const nowIso = () => new Date().toISOString();

const mapEmojiCategoryRow = (row: Partial<EmojiCategoryRow>): EmojiCategoryRow => ({
  id: row.id || randomUUID(),
  label: String(row.label || "").trim(),
  sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
  created_at: row.created_at || nowIso(),
});

const mapAdminEmojiRow = (row: Partial<AdminEmojiRow>): AdminEmojiRow => ({
  id: row.id || randomUUID(),
  category_id: String(row.category_id || ""),
  emoji: String(row.emoji || "").trim(),
  sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
  created_at: row.created_at || nowIso(),
});

const mapAdminBadgeRow = (row: Partial<AdminBadgeRow>): AdminBadgeRow => ({
  id: row.id || randomUUID(),
  name: String(row.name || "").trim(),
  description: String(row.description || ""),
  category: String(row.category || "Inne").trim() || "Inne",
  storage_path: String(row.storage_path || ""),
  sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
  created_at: row.created_at || nowIso(),
});

const mapBadgePackageAccessRow = (row: Partial<BadgePackageAccessRow>): BadgePackageAccessRow => ({
  id: row.id || randomUUID(),
  badge_key: String(row.badge_key || ""),
  package_id: String(row.package_id || ""),
  created_at: row.created_at || nowIso(),
});

const mapFavoriteEmojiRow = (row: Partial<FavoriteEmojiRow>): FavoriteEmojiRow => ({
  id: row.id || randomUUID(),
  user_id: String(row.user_id || ""),
  emoji: String(row.emoji || "").trim(),
  created_at: row.created_at || nowIso(),
});

export const listLocalEmojiCategories = async () => {
  if (!hasLocalDatabase()) return [];

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<EmojiCategoryRow>(
    "SELECT id, label, sort_order, created_at::text FROM admin_emoji_categories ORDER BY sort_order ASC, created_at ASC"
  );
  return rows;
};

export const upsertLocalEmojiCategoryRows = async (rows: Array<Partial<EmojiCategoryRow>>) => {
  if (!hasLocalDatabase()) return [];
  const normalized = rows.map(mapEmojiCategoryRow).filter((row) => row.label.length > 0);
  if (!normalized.length) return [];

  await ensureLocalDatabaseSchema();
  const client = await getPostgresPool().connect();
  try {
    await client.query("BEGIN");
    for (const row of normalized) {
      await client.query(
        [
          "INSERT INTO admin_emoji_categories (id, label, sort_order, created_at)",
          "VALUES ($1, $2, $3, $4)",
          "ON CONFLICT (id) DO UPDATE SET",
          "label = EXCLUDED.label, sort_order = EXCLUDED.sort_order",
        ].join(" "),
        [row.id, row.label, row.sort_order, row.created_at]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const ids = normalized.map((row) => row.id);
  const { rows: savedRows } = await getPostgresPool().query<EmojiCategoryRow>(
    "SELECT id, label, sort_order, created_at::text FROM admin_emoji_categories WHERE id = ANY($1::text[]) ORDER BY sort_order ASC, created_at ASC",
    [ids]
  );
  return savedRows;
};

export const deleteLocalEmojiCategory = async (categoryId: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM admin_emojis WHERE category_id = $1", [categoryId]);
  await getPostgresPool().query("DELETE FROM admin_emoji_categories WHERE id = $1", [categoryId]);
};

export const listLocalAdminEmojis = async (categoryId?: string) => {
  if (!hasLocalDatabase()) return [];

  await ensureLocalDatabaseSchema();
  if (categoryId) {
    const { rows } = await getPostgresPool().query<AdminEmojiRow>(
      [
        "SELECT id, category_id, emoji, sort_order, created_at::text",
        "FROM admin_emojis",
        "WHERE category_id = $1",
        "ORDER BY sort_order ASC, created_at ASC",
      ].join(" "),
      [categoryId]
    );
    return rows;
  }

  const { rows } = await getPostgresPool().query<AdminEmojiRow>(
    "SELECT id, category_id, emoji, sort_order, created_at::text FROM admin_emojis ORDER BY sort_order ASC, created_at ASC"
  );
  return rows;
};

export const upsertLocalAdminEmojiRows = async (rows: Array<Partial<AdminEmojiRow>>) => {
  if (!hasLocalDatabase()) return [];
  const normalized = rows
    .map(mapAdminEmojiRow)
    .filter((row) => row.category_id.length > 0 && row.emoji.length > 0);
  if (!normalized.length) return [];

  await ensureLocalDatabaseSchema();
  const client = await getPostgresPool().connect();
  try {
    await client.query("BEGIN");
    for (const row of normalized) {
      await client.query(
        [
          "INSERT INTO admin_emojis (id, category_id, emoji, sort_order, created_at)",
          "VALUES ($1, $2, $3, $4, $5)",
          "ON CONFLICT (id) DO UPDATE SET",
          "category_id = EXCLUDED.category_id, emoji = EXCLUDED.emoji, sort_order = EXCLUDED.sort_order",
        ].join(" "),
        [row.id, row.category_id, row.emoji, row.sort_order, row.created_at]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const ids = normalized.map((row) => row.id);
  const { rows: savedRows } = await getPostgresPool().query<AdminEmojiRow>(
    [
      "SELECT id, category_id, emoji, sort_order, created_at::text",
      "FROM admin_emojis",
      "WHERE id = ANY($1::text[])",
      "ORDER BY sort_order ASC, created_at ASC",
    ].join(" "),
    [ids]
  );
  return savedRows;
};

export const deleteLocalAdminEmoji = async (emojiId: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM admin_emojis WHERE id = $1", [emojiId]);
};

export const deleteLocalAdminEmojisByCategoryId = async (categoryId: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM admin_emojis WHERE category_id = $1", [categoryId]);
};

export const listLocalAdminBadges = async () => {
  if (!hasLocalDatabase()) return [];

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<AdminBadgeRow>(
    [
      "SELECT id, name, description, category, storage_path, sort_order, created_at::text",
      "FROM admin_badges ORDER BY sort_order ASC, created_at ASC",
    ].join(" ")
  );
  return rows;
};

export const getLocalAdminBadgeById = async (badgeId: string) => {
  if (!hasLocalDatabase()) return null;

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<AdminBadgeRow>(
    [
      "SELECT id, name, description, category, storage_path, sort_order, created_at::text",
      "FROM admin_badges WHERE id = $1 LIMIT 1",
    ].join(" "),
    [badgeId]
  );
  return rows[0] || null;
};

export const upsertLocalAdminBadgeRows = async (rows: Array<Partial<AdminBadgeRow>>) => {
  if (!hasLocalDatabase()) return [];
  const normalized = rows
    .map(mapAdminBadgeRow)
    .filter((row) => row.name.length > 0 && row.storage_path.length > 0);
  if (!normalized.length) return [];

  await ensureLocalDatabaseSchema();
  const client = await getPostgresPool().connect();
  try {
    await client.query("BEGIN");
    for (const row of normalized) {
      await client.query(
        [
          "INSERT INTO admin_badges (id, name, description, category, storage_path, sort_order, created_at)",
          "VALUES ($1, $2, $3, $4, $5, $6, $7)",
          "ON CONFLICT (id) DO UPDATE SET",
          "name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,",
          "storage_path = EXCLUDED.storage_path, sort_order = EXCLUDED.sort_order",
        ].join(" "),
        [row.id, row.name, row.description, row.category, row.storage_path, row.sort_order, row.created_at]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const ids = normalized.map((row) => row.id);
  const { rows: savedRows } = await getPostgresPool().query<AdminBadgeRow>(
    [
      "SELECT id, name, description, category, storage_path, sort_order, created_at::text",
      "FROM admin_badges WHERE id = ANY($1::text[]) ORDER BY sort_order ASC, created_at ASC",
    ].join(" "),
    [ids]
  );
  return savedRows;
};

export const deleteLocalAdminBadge = async (badgeId: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM admin_badges WHERE id = $1", [badgeId]);
};

export const listLocalHiddenStaticBadges = async () => {
  if (!hasLocalDatabase()) return [];

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<HiddenStaticBadgeRow>(
    "SELECT badge_key, created_at::text FROM hidden_static_badges ORDER BY badge_key ASC"
  );
  return rows;
};

export const setLocalStaticBadgeHidden = async (badgeKey: string, hidden: boolean) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();

  if (hidden) {
    await getPostgresPool().query(
      "INSERT INTO hidden_static_badges (badge_key) VALUES ($1) ON CONFLICT (badge_key) DO NOTHING",
      [badgeKey]
    );
    return;
  }

  await getPostgresPool().query("DELETE FROM hidden_static_badges WHERE badge_key = $1", [badgeKey]);
};

export const listLocalBadgePackageAccess = async () => {
  if (!hasLocalDatabase()) return [];

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<BadgePackageAccessRow>(
    "SELECT id, badge_key, package_id, created_at::text FROM badge_package_access ORDER BY created_at ASC"
  );
  return rows;
};

export const getLocalBadgePackageAccess = async (badgeKey: string, packageId: string) => {
  if (!hasLocalDatabase()) return null;

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<BadgePackageAccessRow>(
    [
      "SELECT id, badge_key, package_id, created_at::text",
      "FROM badge_package_access",
      "WHERE badge_key = $1 AND package_id = $2",
      "LIMIT 1",
    ].join(" "),
    [badgeKey, packageId]
  );
  return rows[0] || null;
};

export const setLocalBadgePackageAccess = async (badgeKey: string, packageId: string, enabled: boolean) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();

  if (enabled) {
    const row = mapBadgePackageAccessRow({ badge_key: badgeKey, package_id: packageId });
    await getPostgresPool().query(
      [
        "INSERT INTO badge_package_access (id, badge_key, package_id, created_at)",
        "VALUES ($1, $2, $3, $4)",
        "ON CONFLICT (badge_key, package_id) DO NOTHING",
      ].join(" "),
      [row.id, row.badge_key, row.package_id, row.created_at]
    );
    return;
  }

  await getPostgresPool().query("DELETE FROM badge_package_access WHERE badge_key = $1 AND package_id = $2", [
    badgeKey,
    packageId,
  ]);
};

export const deleteLocalBadgePackageAccessByBadgeKey = async (badgeKey: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM badge_package_access WHERE badge_key = $1", [badgeKey]);
};

export const listLocalFavoriteEmojis = async (userId: string) => {
  if (!hasLocalDatabase()) return [];

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<FavoriteEmojiRow>(
    [
      "SELECT id, user_id, emoji, created_at::text",
      "FROM favorite_emojis",
      "WHERE user_id = $1",
      "ORDER BY created_at DESC",
    ].join(" "),
    [userId]
  );
  return rows;
};

export const setLocalFavoriteEmoji = async (userId: string, emoji: string, favorite: boolean) => {
  if (!hasLocalDatabase()) return;

  await ensureLocalDatabaseSchema();
  const normalizedEmoji = emoji.trim();
  if (!normalizedEmoji) return;

  if (favorite) {
    const row = mapFavoriteEmojiRow({ user_id: userId, emoji: normalizedEmoji });
    await getPostgresPool().query(
      [
        "INSERT INTO favorite_emojis (id, user_id, emoji, created_at)",
        "VALUES ($1, $2, $3, $4)",
        "ON CONFLICT (user_id, emoji) DO UPDATE SET",
        "created_at = EXCLUDED.created_at",
      ].join(" "),
      [row.id, row.user_id, row.emoji, row.created_at]
    );
    return;
  }

  await getPostgresPool().query("DELETE FROM favorite_emojis WHERE user_id = $1 AND emoji = $2", [
    userId,
    normalizedEmoji,
  ]);
};

export const deleteLocalFavoriteEmojisByUserId = async (userId: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM favorite_emojis WHERE user_id = $1", [userId]);
};

export const listLocalErrorLogs = async (filters: LocalErrorLogFilters = {}) => {
  if (!hasLocalDatabase()) return [];

  await ensureLocalDatabaseSchema();
  const values: Array<string | number> = [];
  const clauses: string[] = [];

  if (filters.userId) {
    values.push(filters.userId);
    clauses.push(`user_id = $${values.length}`);
  }

  if (filters.source && filters.source !== "all") {
    values.push(filters.source);
    clauses.push(`source = $${values.length}`);
  }

  const limitValue = Math.min(Math.max(Number(filters.limit || 500), 1), 2000);
  values.push(limitValue);

  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const query = [
    "SELECT id, source, message, stack, context, user_id, created_at::text",
    "FROM error_logs",
    whereSql,
    "ORDER BY created_at DESC",
    `LIMIT $${values.length}`,
  ]
    .filter(Boolean)
    .join(" ");

  const { rows } = await getPostgresPool().query<ErrorLogRow>(query, values);
  return rows.map((row) => ({
    ...row,
    error_type:
      typeof row.context?.errorType === "string"
        ? row.context.errorType
        : typeof row.context?.type === "string"
          ? row.context.type
          : row.source,
    details: row.context,
  }));
};

export const createLocalErrorLog = async (input: LocalErrorLogInput) => {
  if (!hasLocalDatabase()) return null;

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<ErrorLogRow>(
    [
      "INSERT INTO error_logs (source, message, stack, context, user_id)",
      "VALUES ($1, $2, $3, $4::jsonb, $5)",
      "RETURNING id, source, message, stack, context, user_id, created_at::text",
    ].join(" "),
    [
      String(input.source || "api").slice(0, 80),
      String(input.message || "").slice(0, 2000),
      input.stack ? String(input.stack).slice(0, 8000) : null,
      input.context ? JSON.stringify(input.context) : null,
      input.userId || null,
    ],
  );

  return rows[0] || null;
};

export const clearLocalErrorLogsOlderThan = async (cutoffIso: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM error_logs WHERE created_at < $1", [cutoffIso]);
};

export const deleteLocalErrorLogsByUserId = async (userId: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM error_logs WHERE user_id = $1", [userId]);
};
