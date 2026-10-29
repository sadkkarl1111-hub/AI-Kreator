import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { ensureLocalDatabaseSchema, getPostgresPool, hasLocalDatabase } from "./postgres.js";

export type ProfileRow = {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string | null;
};

export type AuthUserRow = {
  user_id: string;
  email: string | null;
  email_confirmed_at: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  updated_at: string | null;
};

export type UserCreditRow = {
  id: string;
  user_id: string;
  balance: number;
  created_at: string | null;
  updated_at: string | null;
};

export type UserRoleRow = {
  id: string;
  user_id: string;
  role: string;
  created_at: string | null;
};

export type AdminPanelRoleRow = {
  role_key: string;
  label: string;
  created_at: string | null;
};

export type AdminPanelRoleTabRow = {
  id: string;
  role_key: string;
  tab_key: string;
  created_at: string | null;
};

export type AdminPanelUserRoleRow = {
  id: string;
  user_id: string;
  role_key: string;
  created_at: string | null;
};

export type FavoriteToolRow = {
  id: string;
  user_id: string;
  tool_id: string;
  created_at: string | null;
};

export type DailyFreeUsageRow = {
  id: string;
  user_id: string;
  feature: string;
  usage_date: string;
  count: number;
};

export type UserDataSyncResult = {
  ok: boolean;
  skipped: boolean;
  authUsers: number;
  profiles: number;
  userCredits: number;
  userRoles: number;
  adminPanelRoles: number;
  adminPanelRoleTabs: number;
  adminPanelUserRoles: number;
  favoriteTools: number;
  dailyFreeUsage: number;
};

const LOCAL_TABLES = {
  authUsers: "auth_users",
  profiles: "profiles",
  userCredits: "user_credits",
  userRoles: "user_roles",
  adminPanelRoles: "admin_panel_roles",
  adminPanelRoleTabs: "admin_panel_role_tabs",
  adminPanelUserRoles: "admin_panel_user_roles",
  favoriteTools: "favorite_tools",
  dailyFreeUsage: "daily_free_usage",
} as const;

const withLocalClient = async <T>(handler: (client: PoolClient) => Promise<T>) => {
  await ensureLocalDatabaseSchema();
  const client = await getPostgresPool().connect();
  try {
    return await handler(client);
  } finally {
    client.release();
  }
};

const countLocalRows = async (tableName: string) => {
  const { rows } = await getPostgresPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${tableName}`
  );
  return Number(rows[0]?.count || 0);
};

const mapProfileRow = (row: Partial<ProfileRow>): ProfileRow => ({
  id: String(row.id || randomUUID()),
  user_id: String(row.user_id || ""),
  email: row.email ?? null,
  display_name: row.display_name ?? null,
  created_at: row.created_at ?? new Date().toISOString(),
});

const mapAuthUserRow = (row: Partial<AuthUserRow>): AuthUserRow => ({
  user_id: String(row.user_id || ""),
  email: row.email ?? null,
  email_confirmed_at: row.email_confirmed_at ?? null,
  created_at: row.created_at ?? null,
  last_sign_in_at: row.last_sign_in_at ?? null,
  updated_at: row.updated_at ?? new Date().toISOString(),
});

const mapUserCreditRow = (row: Partial<UserCreditRow>): UserCreditRow => ({
  id: String(row.id || randomUUID()),
  user_id: String(row.user_id || ""),
  balance: Number(row.balance ?? 0),
  created_at: row.created_at ?? new Date().toISOString(),
  updated_at: row.updated_at ?? new Date().toISOString(),
});

const mapUserRoleRow = (row: Partial<UserRoleRow>): UserRoleRow => ({
  id: String(row.id || randomUUID()),
  user_id: String(row.user_id || ""),
  role: String(row.role || ""),
  created_at: row.created_at ?? new Date().toISOString(),
});

const mapAdminPanelRoleRow = (row: Partial<AdminPanelRoleRow>): AdminPanelRoleRow => ({
  role_key: String(row.role_key || ""),
  label: String(row.label ?? ""),
  created_at: row.created_at ?? new Date().toISOString(),
});

const mapAdminPanelRoleTabRow = (row: Partial<AdminPanelRoleTabRow>): AdminPanelRoleTabRow => ({
  id: String(row.id || randomUUID()),
  role_key: String(row.role_key || ""),
  tab_key: String(row.tab_key || ""),
  created_at: row.created_at ?? new Date().toISOString(),
});

const mapAdminPanelUserRoleRow = (row: Partial<AdminPanelUserRoleRow>): AdminPanelUserRoleRow => ({
  id: String(row.id || randomUUID()),
  user_id: String(row.user_id || ""),
  role_key: String(row.role_key || ""),
  created_at: row.created_at ?? new Date().toISOString(),
});

const mapFavoriteToolRow = (row: Partial<FavoriteToolRow>): FavoriteToolRow => ({
  id: String(row.id || randomUUID()),
  user_id: String(row.user_id || ""),
  tool_id: String(row.tool_id || ""),
  created_at: row.created_at ?? new Date().toISOString(),
});

const mapDailyFreeUsageRow = (row: Partial<DailyFreeUsageRow>): DailyFreeUsageRow => ({
  id: String(row.id || randomUUID()),
  user_id: String(row.user_id || ""),
  feature: String(row.feature || ""),
  usage_date: String(row.usage_date || new Date().toISOString().slice(0, 10)),
  count: Number(row.count ?? 0),
});

const getMissingIds = (expected: string[], actual: string[]) => {
  const actualSet = new Set(actual);
  return expected.filter((value) => !actualSet.has(value));
};

const fetchFallbackProfiles = async (): Promise<ProfileRow[]> => [];

const fetchFallbackAuthUsers = async (): Promise<AuthUserRow[]> => [];

const fetchFallbackAuthUserByUserId = async (_userId: string): Promise<AuthUserRow | null> => null;

const fetchFallbackAuthUserByEmail = async (_email: string): Promise<AuthUserRow | null> => null;

const fetchFallbackProfilesByUserIds = async (_userIds: string[]): Promise<ProfileRow[]> => [];

const fetchFallbackProfileByUserId = async (_userId: string): Promise<ProfileRow | null> => null;

const fetchFallbackUserCredits = async (): Promise<UserCreditRow[]> => [];

const fetchFallbackUserCreditByUserId = async (_userId: string): Promise<UserCreditRow | null> => null;

const fetchFallbackUserRoles = async (): Promise<UserRoleRow[]> => [];

const fetchFallbackUserRolesByUserId = async (_userId: string): Promise<UserRoleRow[]> => [];

const fetchFallbackAdminPanelRoles = async (): Promise<AdminPanelRoleRow[]> => [];

const fetchFallbackAdminPanelRoleTabs = async (): Promise<AdminPanelRoleTabRow[]> => [];

const fetchFallbackAdminPanelRoleTabsByRoleKey = async (
  _roleKey: string
): Promise<AdminPanelRoleTabRow[]> => [];

const fetchFallbackAdminPanelUserRoles = async (): Promise<AdminPanelUserRoleRow[]> => [];

const fetchFallbackAdminPanelUserRoleByUserId = async (
  _userId: string
): Promise<AdminPanelUserRoleRow | null> => null;

const fetchFallbackFavoriteTools = async (): Promise<FavoriteToolRow[]> => [];

const fetchFallbackFavoriteToolsByUserId = async (_userId: string): Promise<FavoriteToolRow[]> => [];

const fetchFallbackDailyFreeUsage = async (): Promise<DailyFreeUsageRow[]> => [];

const fetchFallbackDailyFreeUsageByKey = async (
  _userId: string,
  _feature: string,
  _usageDate: string
): Promise<DailyFreeUsageRow | null> => null;

const replaceLocalProfiles = async (rows: ProfileRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM profiles");
      for (const row of rows) {
        await client.query(
          "INSERT INTO profiles (id, user_id, email, display_name, created_at) VALUES ($1, $2, $3, $4, $5)",
          [row.id, row.user_id, row.email, row.display_name, row.created_at]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalAuthUsers = async (rows: AuthUserRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM auth_users");
      for (const row of rows) {
        await client.query(
          "INSERT INTO auth_users (user_id, email, email_confirmed_at, created_at, last_sign_in_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
          [row.user_id, row.email, row.email_confirmed_at, row.created_at, row.last_sign_in_at, row.updated_at]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalUserCredits = async (rows: UserCreditRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM user_credits");
      for (const row of rows) {
        await client.query(
          "INSERT INTO user_credits (id, user_id, balance, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
          [row.id, row.user_id, row.balance, row.created_at, row.updated_at]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalUserRoles = async (rows: UserRoleRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM user_roles");
      for (const row of rows) {
        await client.query(
          "INSERT INTO user_roles (id, user_id, role, created_at) VALUES ($1, $2, $3, $4)",
          [row.id, row.user_id, row.role, row.created_at]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalAdminPanelRoles = async (rows: AdminPanelRoleRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM admin_panel_roles");
      for (const row of rows) {
        await client.query(
          "INSERT INTO admin_panel_roles (role_key, label, created_at) VALUES ($1, $2, $3)",
          [row.role_key, row.label, row.created_at]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalAdminPanelRoleTabs = async (rows: AdminPanelRoleTabRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM admin_panel_role_tabs");
      for (const row of rows) {
        await client.query(
          "INSERT INTO admin_panel_role_tabs (id, role_key, tab_key, created_at) VALUES ($1, $2, $3, $4)",
          [row.id, row.role_key, row.tab_key, row.created_at]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalAdminPanelUserRoles = async (rows: AdminPanelUserRoleRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM admin_panel_user_roles");
      for (const row of rows) {
        await client.query(
          "INSERT INTO admin_panel_user_roles (id, user_id, role_key, created_at) VALUES ($1, $2, $3, $4)",
          [row.id, row.user_id, row.role_key, row.created_at]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalFavoriteTools = async (rows: FavoriteToolRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM favorite_tools");
      for (const row of rows) {
        await client.query(
          "INSERT INTO favorite_tools (id, user_id, tool_id, created_at) VALUES ($1, $2, $3, $4)",
          [row.id, row.user_id, row.tool_id, row.created_at]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalDailyFreeUsage = async (rows: DailyFreeUsageRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM daily_free_usage");
      for (const row of rows) {
        await client.query(
          "INSERT INTO daily_free_usage (id, user_id, feature, usage_date, count) VALUES ($1, $2, $3, $4, $5)",
          [row.id, row.user_id, row.feature, row.usage_date, row.count]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

export const syncLocalUserData = async ({
  onlyIfEmpty = false,
}: {
  onlyIfEmpty?: boolean;
} = {}): Promise<UserDataSyncResult> => {
  void onlyIfEmpty;
  if (hasLocalDatabase()) {
    await ensureLocalDatabaseSchema();
  }

  return {
    ok: true,
    skipped: true,
    authUsers: 0,
    profiles: 0,
    userCredits: 0,
    userRoles: 0,
    adminPanelRoles: 0,
    adminPanelRoleTabs: 0,
    adminPanelUserRoles: 0,
    favoriteTools: 0,
    dailyFreeUsage: 0,
  };
};

export const listLocalAuthUsers = async () => {
  if (!hasLocalDatabase()) {
    return fetchFallbackAuthUsers();
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<AuthUserRow>(
    "SELECT user_id, email, email_confirmed_at, created_at, last_sign_in_at, updated_at FROM auth_users ORDER BY created_at ASC NULLS LAST, user_id ASC"
  );
  if (rows.length) return rows;

  const fallbackRows = await fetchFallbackAuthUsers();
  if (fallbackRows.length) {
    await replaceLocalAuthUsers(fallbackRows);
  }
  return fallbackRows;
};

export const getLocalAuthUsersByUserIds = async (userIds: string[]) => {
  if (!userIds.length) return [];

  if (!hasLocalDatabase()) {
  const rows = await fetchFallbackAuthUsers();
    return rows.filter((row) => userIds.includes(row.user_id));
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<AuthUserRow>(
    "SELECT user_id, email, email_confirmed_at, created_at, last_sign_in_at, updated_at FROM auth_users WHERE user_id = ANY($1::text[])",
    [userIds]
  );

  const missingIds = getMissingIds(userIds, rows.map((row) => row.user_id));
  if (!missingIds.length) {
    return userIds
      .map((userId) => rows.find((row) => row.user_id === userId))
      .filter((row): row is AuthUserRow => Boolean(row));
  }

  const syncedRows = await Promise.all(missingIds.map((userId) => fetchFallbackAuthUserByUserId(userId)));
  const filteredSyncedRows = syncedRows.filter((row): row is AuthUserRow => Boolean(row));
  if (filteredSyncedRows.length) {
    await upsertLocalAuthUsersRows(filteredSyncedRows);
  }

  const merged = [...rows, ...filteredSyncedRows];
  return userIds
    .map((userId) => merged.find((row) => row.user_id === userId))
    .filter((row): row is AuthUserRow => Boolean(row));
};

export const getLocalAuthUser = async (userId: string) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackAuthUserByUserId(userId);
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<AuthUserRow>(
    "SELECT user_id, email, email_confirmed_at, created_at, last_sign_in_at, updated_at FROM auth_users WHERE user_id = $1 LIMIT 1",
    [userId]
  );

  if (rows[0]) return rows[0];

  const fallbackRow = await fetchFallbackAuthUserByUserId(userId);
  if (fallbackRow) {
    await upsertLocalAuthUsersRows([fallbackRow]);
  }

  return fallbackRow;
};

export const getLocalAuthUserByEmail = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  if (!hasLocalDatabase()) {
    return fetchFallbackAuthUserByEmail(normalizedEmail);
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<AuthUserRow>(
    [
      "SELECT user_id, email, email_confirmed_at, created_at, last_sign_in_at, updated_at",
      "FROM auth_users WHERE LOWER(COALESCE(email, '')) = $1 LIMIT 1",
    ].join(" "),
    [normalizedEmail]
  );

  if (rows[0]) return rows[0];

  const fallbackRow = await fetchFallbackAuthUserByEmail(normalizedEmail);
  if (fallbackRow) {
    await upsertLocalAuthUsersRows([fallbackRow]);
  }

  return fallbackRow;
};

export const upsertLocalAuthUsersRows = async (rows: Array<Partial<AuthUserRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapAuthUserRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO auth_users (user_id, email, email_confirmed_at, created_at, last_sign_in_at, updated_at)",
          "VALUES ($1, $2, $3, $4, $5, $6)",
          "ON CONFLICT (user_id) DO UPDATE SET",
          "email = COALESCE(EXCLUDED.email, auth_users.email),",
          "email_confirmed_at = COALESCE(EXCLUDED.email_confirmed_at, auth_users.email_confirmed_at),",
          "created_at = COALESCE(EXCLUDED.created_at, auth_users.created_at),",
          "last_sign_in_at = COALESCE(EXCLUDED.last_sign_in_at, auth_users.last_sign_in_at),",
          "updated_at = EXCLUDED.updated_at",
        ].join(" "),
        [row.user_id, row.email, row.email_confirmed_at, row.created_at, row.last_sign_in_at, row.updated_at]
      );
    }
  });

  return getLocalAuthUsersByUserIds(normalizedRows.map((row) => row.user_id));
};

export const deleteLocalAuthUser = async (userId: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM auth_users WHERE user_id = $1", [userId]);
};

export const listLocalProfiles = async () => {
  if (!hasLocalDatabase()) {
    return fetchFallbackProfiles();
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<ProfileRow>(
    "SELECT id, user_id, email, display_name, created_at FROM profiles ORDER BY created_at ASC"
  );
  return rows;
};

export const getLocalProfilesByUserIds = async (userIds: string[]) => {
  if (!userIds.length) return [];

  if (!hasLocalDatabase()) {
    return fetchFallbackProfilesByUserIds(userIds);
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<ProfileRow>(
    "SELECT id, user_id, email, display_name, created_at FROM profiles WHERE user_id = ANY($1::text[])",
    [userIds]
  );

  const missingIds = getMissingIds(userIds, rows.map((row) => row.user_id));
  if (!missingIds.length) {
    return userIds
      .map((userId) => rows.find((row) => row.user_id === userId))
      .filter((row): row is ProfileRow => Boolean(row));
  }

  const syncedRows = await fetchFallbackProfilesByUserIds(missingIds);
  if (syncedRows.length) {
    await upsertLocalProfilesRows(syncedRows);
  }

  const merged = [...rows, ...syncedRows];
  return userIds
    .map((userId) => merged.find((row) => row.user_id === userId))
    .filter((row): row is ProfileRow => Boolean(row));
};

export const getLocalProfile = async (userId: string) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackProfileByUserId(userId);
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<ProfileRow>(
    "SELECT id, user_id, email, display_name, created_at FROM profiles WHERE user_id = $1 LIMIT 1",
    [userId]
  );

  if (rows[0]) return rows[0];

  const fallbackRow = await fetchFallbackProfileByUserId(userId);
  if (fallbackRow) {
    await upsertLocalProfilesRows([fallbackRow]);
  }

  return fallbackRow;
};

export const upsertLocalProfilesRows = async (rows: Array<Partial<ProfileRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapProfileRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO profiles (id, user_id, email, display_name, created_at)",
          "VALUES ($1, $2, $3, $4, $5)",
          "ON CONFLICT (user_id) DO UPDATE SET",
          "id = EXCLUDED.id, email = EXCLUDED.email, display_name = EXCLUDED.display_name, created_at = EXCLUDED.created_at",
        ].join(" "),
        [row.id, row.user_id, row.email, row.display_name, row.created_at]
      );
    }
  });

  return getLocalProfilesByUserIds(normalizedRows.map((row) => row.user_id));
};

export const deleteLocalProfileByUserId = async (userId: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM profiles WHERE user_id = $1", [userId]);
};

export const listLocalUserCredits = async () => {
  if (!hasLocalDatabase()) {
    return fetchFallbackUserCredits();
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<UserCreditRow>(
    "SELECT id, user_id, balance, created_at, updated_at FROM user_credits ORDER BY created_at ASC"
  );
  return rows;
};

export const getLocalUserCredit = async (userId: string) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackUserCreditByUserId(userId);
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<UserCreditRow>(
    "SELECT id, user_id, balance, created_at, updated_at FROM user_credits WHERE user_id = $1 LIMIT 1",
    [userId]
  );

  if (rows[0]) return rows[0];

  const fallbackRow = await fetchFallbackUserCreditByUserId(userId);
  if (fallbackRow) {
    await upsertLocalUserCreditsRows([fallbackRow]);
  }

  return fallbackRow;
};

export const upsertLocalUserCreditsRows = async (rows: Array<Partial<UserCreditRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapUserCreditRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO user_credits (id, user_id, balance, created_at, updated_at)",
          "VALUES ($1, $2, $3, $4, $5)",
          "ON CONFLICT (user_id) DO UPDATE SET",
          "id = EXCLUDED.id, balance = EXCLUDED.balance, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at",
        ].join(" "),
        [row.id, row.user_id, row.balance, row.created_at, row.updated_at]
      );
    }
  });

  const userIds = normalizedRows.map((row) => row.user_id);
  const { rows: resultRows } = await getPostgresPool().query<UserCreditRow>(
    "SELECT id, user_id, balance, created_at, updated_at FROM user_credits WHERE user_id = ANY($1::text[])",
    [userIds]
  );
  return resultRows;
};

export const setLocalUserCreditsBalance = async (userId: string, balance: number) => {
  if (!hasLocalDatabase()) return null;

  const existing = await getLocalUserCredit(userId);
  const row = mapUserCreditRow({
    id: existing?.id || undefined,
    user_id: userId,
    balance,
    created_at: existing?.created_at ?? undefined,
    updated_at: new Date().toISOString(),
  });

  const [savedRow] = await upsertLocalUserCreditsRows([row]);
  return savedRow ?? row;
};

export const deductLocalUserCreditsBalance = async (userId: string, cost: number) => {
  const normalizedCost = Math.max(Math.floor(Number(cost) || 0), 0);
  if (normalizedCost <= 0) {
    return getLocalUserCredit(userId);
  }

  if (!hasLocalDatabase()) {
    const existing = await getLocalUserCredit(userId);
    const currentBalance = Number(existing?.balance ?? 0);
    if (currentBalance < normalizedCost) return null;
    return setLocalUserCreditsBalance(userId, currentBalance - normalizedCost);
  }

  await ensureLocalDatabaseSchema();
  await getPostgresPool().query(
    [
      "INSERT INTO user_credits (user_id, balance)",
      "VALUES ($1, 0)",
      "ON CONFLICT (user_id) DO NOTHING",
    ].join(" "),
    [userId]
  );

  const { rows } = await getPostgresPool().query<UserCreditRow>(
    [
      "UPDATE user_credits",
      "SET balance = balance - $2, updated_at = now()",
      "WHERE user_id = $1 AND balance >= $2",
      "RETURNING id, user_id, balance, created_at, updated_at",
    ].join(" "),
    [userId, normalizedCost]
  );

  return rows[0] ?? null;
};

export const addLocalUserCreditsBalance = async (userId: string, amount: number) => {
  const normalizedAmount = Math.max(Math.floor(Number(amount) || 0), 0);
  if (normalizedAmount <= 0) {
    return getLocalUserCredit(userId);
  }

  if (!hasLocalDatabase()) {
    const existing = await getLocalUserCredit(userId);
    const currentBalance = Number(existing?.balance ?? 0);
    return setLocalUserCreditsBalance(userId, currentBalance + normalizedAmount);
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<UserCreditRow>(
    [
      "INSERT INTO user_credits (user_id, balance)",
      "VALUES ($1, $2)",
      "ON CONFLICT (user_id) DO UPDATE SET",
      "balance = user_credits.balance + EXCLUDED.balance, updated_at = now()",
      "RETURNING id, user_id, balance, created_at, updated_at",
    ].join(" "),
    [userId, normalizedAmount]
  );

  return rows[0] ?? null;
};

export const deleteLocalUserCreditsByUserId = async (userId: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM user_credits WHERE user_id = $1", [userId]);
};

export const listLocalUserRoles = async () => {
  if (!hasLocalDatabase()) {
    return fetchFallbackUserRoles();
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<UserRoleRow>(
    "SELECT id, user_id, role, created_at FROM user_roles ORDER BY created_at ASC"
  );
  return rows;
};

export const getLocalUserRoles = async (userId: string) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackUserRolesByUserId(userId);
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<UserRoleRow>(
    "SELECT id, user_id, role, created_at FROM user_roles WHERE user_id = $1 ORDER BY created_at ASC",
    [userId]
  );

  if (rows.length) return rows;

  const fallbackRows = await fetchFallbackUserRolesByUserId(userId);
  if (fallbackRows.length) {
    await upsertLocalUserRolesRows(fallbackRows);
  }

  return fallbackRows;
};

export const hasLocalUserRole = async (userId: string, role: string) => {
  const rows = await getLocalUserRoles(userId);
  return rows.some((row) => row.role === role);
};

export const upsertLocalUserRolesRows = async (rows: Array<Partial<UserRoleRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapUserRoleRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO user_roles (id, user_id, role, created_at)",
          "VALUES ($1, $2, $3, $4)",
          "ON CONFLICT (user_id, role) DO UPDATE SET",
          "id = EXCLUDED.id, created_at = EXCLUDED.created_at",
        ].join(" "),
        [row.id, row.user_id, row.role, row.created_at]
      );
    }
  });

  return normalizedRows;
};

export const setLocalUserRole = async (userId: string, role: string, enabled: boolean) => {
  if (!hasLocalDatabase()) return;

  await ensureLocalDatabaseSchema();
  if (!enabled) {
    await getPostgresPool().query("DELETE FROM user_roles WHERE user_id = $1 AND role = $2", [userId, role]);
    return;
  }

  await upsertLocalUserRolesRows([{ user_id: userId, role }]);
};

export const deleteLocalUserRolesByUserId = async (userId: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
};

export const listLocalAdminPanelRoles = async () => {
  if (!hasLocalDatabase()) {
    return fetchFallbackAdminPanelRoles();
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<AdminPanelRoleRow>(
    "SELECT role_key, label, created_at FROM admin_panel_roles ORDER BY label ASC"
  );
  if (rows.length) return rows;

  const fallbackRows = await fetchFallbackAdminPanelRoles();
  if (fallbackRows.length) {
    await upsertLocalAdminPanelRolesRows(fallbackRows);
  }
  return fallbackRows;
};

export const upsertLocalAdminPanelRolesRows = async (rows: Array<Partial<AdminPanelRoleRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapAdminPanelRoleRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO admin_panel_roles (role_key, label, created_at)",
          "VALUES ($1, $2, $3)",
          "ON CONFLICT (role_key) DO UPDATE SET",
          "label = EXCLUDED.label, created_at = EXCLUDED.created_at",
        ].join(" "),
        [row.role_key, row.label, row.created_at]
      );
    }
  });

  return listLocalAdminPanelRoles();
};

export const listLocalAdminPanelRoleTabs = async () => {
  if (!hasLocalDatabase()) {
    return fetchFallbackAdminPanelRoleTabs();
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<AdminPanelRoleTabRow>(
    "SELECT id, role_key, tab_key, created_at FROM admin_panel_role_tabs ORDER BY role_key ASC, tab_key ASC"
  );
  if (rows.length) return rows;

  const fallbackRows = await fetchFallbackAdminPanelRoleTabs();
  if (fallbackRows.length) {
    await upsertLocalAdminPanelRoleTabsRows(fallbackRows);
  }
  return fallbackRows;
};

export const upsertLocalAdminPanelRoleTabsRows = async (rows: Array<Partial<AdminPanelRoleTabRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapAdminPanelRoleTabRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO admin_panel_role_tabs (id, role_key, tab_key, created_at)",
          "VALUES ($1, $2, $3, $4)",
          "ON CONFLICT (role_key, tab_key) DO UPDATE SET",
          "id = EXCLUDED.id, created_at = EXCLUDED.created_at",
        ].join(" "),
        [row.id, row.role_key, row.tab_key, row.created_at]
      );
    }
  });

  return listLocalAdminPanelRoleTabs();
};

export const deleteLocalAdminPanelRoleTab = async (roleKey: string, tabKey: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM admin_panel_role_tabs WHERE role_key = $1 AND tab_key = $2", [
    roleKey,
    tabKey,
  ]);
};

export const getLocalAdminPanelUserRole = async (userId: string) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackAdminPanelUserRoleByUserId(userId);
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<AdminPanelUserRoleRow>(
    "SELECT id, user_id, role_key, created_at FROM admin_panel_user_roles WHERE user_id = $1 LIMIT 1",
    [userId]
  );

  if (rows[0]) return rows[0];

  const fallbackRow = await fetchFallbackAdminPanelUserRoleByUserId(userId);
  if (fallbackRow) {
    await upsertLocalAdminPanelUserRolesRows([fallbackRow]);
  }

  return fallbackRow;
};

export const listLocalAdminPanelUserRoles = async () => {
  if (!hasLocalDatabase()) {
    return fetchFallbackAdminPanelUserRoles();
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<AdminPanelUserRoleRow>(
    "SELECT id, user_id, role_key, created_at FROM admin_panel_user_roles ORDER BY created_at ASC"
  );
  return rows;
};

export const upsertLocalAdminPanelUserRolesRows = async (rows: Array<Partial<AdminPanelUserRoleRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapAdminPanelUserRoleRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO admin_panel_user_roles (id, user_id, role_key, created_at)",
          "VALUES ($1, $2, $3, $4)",
          "ON CONFLICT (user_id) DO UPDATE SET",
          "id = EXCLUDED.id, role_key = EXCLUDED.role_key, created_at = EXCLUDED.created_at",
        ].join(" "),
        [row.id, row.user_id, row.role_key, row.created_at]
      );
    }
  });

  return normalizedRows;
};

export const setLocalAdminPanelUserRole = async (userId: string, roleKey: string | null) => {
  if (!hasLocalDatabase()) return;

  await ensureLocalDatabaseSchema();
  if (!roleKey) {
    await getPostgresPool().query("DELETE FROM admin_panel_user_roles WHERE user_id = $1", [userId]);
    return;
  }

  await upsertLocalAdminPanelUserRolesRows([{ user_id: userId, role_key: roleKey }]);
};

export const listLocalAllowedAdminTabs = async (userId: string) => {
  const panelRole = await getLocalAdminPanelUserRole(userId);
  if (!panelRole?.role_key) return [];

  if (!hasLocalDatabase()) {
    const rows = await fetchFallbackAdminPanelRoleTabsByRoleKey(panelRole.role_key);
    return Array.from(new Set(rows.map((row) => row.tab_key))).sort();
  }

  await ensureLocalDatabaseSchema();
  let { rows } = await getPostgresPool().query<{ tab_key: string }>(
    "SELECT tab_key FROM admin_panel_role_tabs WHERE role_key = $1 ORDER BY tab_key ASC",
    [panelRole.role_key]
  );

  if (!rows.length) {
  const fallbackRows = await fetchFallbackAdminPanelRoleTabsByRoleKey(panelRole.role_key);
    if (fallbackRows.length) {
      await upsertLocalAdminPanelRoleTabsRows(fallbackRows);
      rows = fallbackRows.map((row) => ({ tab_key: row.tab_key }));
    }
  }

  return Array.from(new Set(rows.map((row) => row.tab_key))).sort();
};

export const listLocalFavoriteTools = async (userId: string) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackFavoriteToolsByUserId(userId);
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<FavoriteToolRow>(
    "SELECT id, user_id, tool_id, created_at FROM favorite_tools WHERE user_id = $1 ORDER BY created_at ASC",
    [userId]
  );

  if (rows.length) return rows;

  const fallbackRows = await fetchFallbackFavoriteToolsByUserId(userId);
  if (fallbackRows.length) {
    await upsertLocalFavoriteToolsRows(fallbackRows);
  }

  return fallbackRows;
};

export const upsertLocalFavoriteToolsRows = async (rows: Array<Partial<FavoriteToolRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapFavoriteToolRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO favorite_tools (id, user_id, tool_id, created_at)",
          "VALUES ($1, $2, $3, $4)",
          "ON CONFLICT (user_id, tool_id) DO UPDATE SET",
          "id = EXCLUDED.id, created_at = EXCLUDED.created_at",
        ].join(" "),
        [row.id, row.user_id, row.tool_id, row.created_at]
      );
    }
  });

  return normalizedRows;
};

export const setLocalFavoriteTool = async (userId: string, toolId: string, favorite: boolean) => {
  if (!hasLocalDatabase()) return;

  await ensureLocalDatabaseSchema();
  if (favorite) {
    await upsertLocalFavoriteToolsRows([{ user_id: userId, tool_id: toolId }]);
    return;
  }

  await getPostgresPool().query("DELETE FROM favorite_tools WHERE user_id = $1 AND tool_id = $2", [userId, toolId]);
};

export const getLocalDailyFreeUsage = async (userId: string, feature: string, usageDate: string) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackDailyFreeUsageByKey(userId, feature, usageDate);
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<DailyFreeUsageRow>(
    "SELECT id, user_id, feature, usage_date::text, count FROM daily_free_usage WHERE user_id = $1 AND feature = $2 AND usage_date = $3 LIMIT 1",
    [userId, feature, usageDate]
  );

  if (rows[0]) return rows[0];

  const fallbackRow = await fetchFallbackDailyFreeUsageByKey(userId, feature, usageDate);
  if (fallbackRow) {
    await upsertLocalDailyFreeUsageRows([fallbackRow]);
  }

  return fallbackRow;
};

export const upsertLocalDailyFreeUsageRows = async (rows: Array<Partial<DailyFreeUsageRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapDailyFreeUsageRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO daily_free_usage (id, user_id, feature, usage_date, count)",
          "VALUES ($1, $2, $3, $4, $5)",
          "ON CONFLICT (user_id, feature, usage_date) DO UPDATE SET",
          "id = EXCLUDED.id, count = EXCLUDED.count",
        ].join(" "),
        [row.id, row.user_id, row.feature, row.usage_date, row.count]
      );
    }
  });

  return normalizedRows;
};

export const incrementLocalDailyFreeUsage = async (userId: string, feature: string, usageDate: string) => {
  if (!hasLocalDatabase()) return null;

  const existing = await getLocalDailyFreeUsage(userId, feature, usageDate);
  const nextCount = (existing?.count ?? 0) + 1;

  const [savedRow] = await upsertLocalDailyFreeUsageRows([
    {
      id: existing?.id,
      user_id: userId,
      feature,
      usage_date: usageDate,
      count: nextCount,
    },
  ]);

  return savedRow ?? {
    id: existing?.id || "",
    user_id: userId,
    feature,
    usage_date: usageDate,
    count: nextCount,
  };
};

export const deleteLocalUserMirror = async (userId: string) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM daily_free_usage WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM favorite_tools WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM admin_panel_user_roles WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM user_credits WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM profiles WHERE user_id = $1", [userId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};
