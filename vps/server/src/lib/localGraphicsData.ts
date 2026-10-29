import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { ensureLocalDatabaseSchema, getPostgresPool, hasLocalDatabase } from "./postgres.js";

export type GraphicFilter = "all" | "generated" | "template";

export type LocalGraphicRow = {
  id: string;
  user_id: string | null;
  url: string | null;
  prompt: string;
  style: string;
  type: string;
  dimensions: string | null;
  created_at: string | null;
  public_token: string | null;
  is_public: boolean;
  parent_id: string | null;
};

export type LocalGraphicHistoryRow = {
  id: string;
  graphic_id: string | null;
  user_id: string | null;
  prompt: string;
  style: string;
  type: string;
  dimensions: string | null;
  created_at: string | null;
};

type GraphicInputRow = Partial<LocalGraphicRow>;

const GRAPHICS_SELECT =
  "id, user_id, url, prompt, style, type, dimensions, created_at, public_token, is_public, parent_id";
const GRAPHICS_HISTORY_SELECT =
  "id, graphic_id, user_id, prompt, style, type, dimensions, created_at";
const GRAPHICS_HISTORY_SEEDED_KEY = "graphics_history_seeded_v1";
let graphicsHistorySeedPromise: Promise<void> | null = null;

const withLocalClient = async <T>(handler: (client: PoolClient) => Promise<T>) => {
  await ensureLocalDatabaseSchema();
  const client = await getPostgresPool().connect();
  try {
    return await handler(client);
  } finally {
    client.release();
  }
};

const mapGraphicRow = (row: GraphicInputRow): LocalGraphicRow => ({
  id: String(row.id || randomUUID()),
  user_id: row.user_id ?? null,
  url: row.url ?? null,
  prompt: String(row.prompt ?? ""),
  style: String(row.style ?? ""),
  type: String(row.type ?? "generated"),
  dimensions: row.dimensions ?? null,
  created_at: row.created_at ?? new Date().toISOString(),
  public_token: row.public_token ?? null,
  is_public: Boolean(row.is_public),
  parent_id: row.parent_id ?? null,
});

const mapGraphicHistoryRow = (row: Partial<LocalGraphicHistoryRow>): LocalGraphicHistoryRow => ({
  id: String(row.id || randomUUID()),
  graphic_id: row.graphic_id ?? null,
  user_id: row.user_id ?? null,
  prompt: String(row.prompt ?? ""),
  style: String(row.style ?? ""),
  type: String(row.type ?? "generated"),
  dimensions: row.dimensions ?? null,
  created_at: row.created_at ?? new Date().toISOString(),
});

const countLocalGraphics = async () => {
  const { rows } = await getPostgresPool().query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM graphics"
  );
  return Number(rows[0]?.count || 0);
};

const countLocalGraphicsHistory = async () => {
  const { rows } = await getPostgresPool().query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM graphics_history"
  );
  return Number(rows[0]?.count || 0);
};

const getMigrationState = async (key: string) => {
  const { rows } = await getPostgresPool().query<{ value: string }>(
    "SELECT value FROM migration_state WHERE key = $1 LIMIT 1",
    [key]
  );
  return rows[0]?.value ?? null;
};

const setMigrationState = async (key: string, value: string) => {
  await getPostgresPool().query(
    [
      "INSERT INTO migration_state (key, value, updated_at)",
      "VALUES ($1, $2, now())",
      "ON CONFLICT (key)",
      "DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at",
    ].join(" "),
    [key, value]
  );
};

export const upsertLocalGraphicsRows = async (rows: GraphicInputRow[]) => {
  if (!hasLocalDatabase() || rows.length === 0) return [] as LocalGraphicRow[];

  const normalizedRows = rows.map(mapGraphicRow);

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      for (const row of normalizedRows) {
        await client.query(
          [
            "INSERT INTO graphics",
            "(id, user_id, url, prompt, style, type, dimensions, created_at, public_token, is_public, parent_id)",
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
            "ON CONFLICT (id) DO UPDATE SET",
            "user_id = EXCLUDED.user_id,",
            "url = EXCLUDED.url,",
            "prompt = EXCLUDED.prompt,",
            "style = EXCLUDED.style,",
            "type = EXCLUDED.type,",
            "dimensions = EXCLUDED.dimensions,",
            "created_at = EXCLUDED.created_at,",
            "public_token = EXCLUDED.public_token,",
            "is_public = EXCLUDED.is_public,",
            "parent_id = EXCLUDED.parent_id",
          ].join(" "),
          [
            row.id,
            row.user_id,
            row.url,
            row.prompt,
            row.style,
            row.type,
            row.dimensions,
            row.created_at,
            row.public_token,
            row.is_public,
            row.parent_id,
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  return normalizedRows;
};

export const updateLocalGraphicUrl = async (id: string, url: string) => {
  if (!hasLocalDatabase()) return;

  await getPostgresPool().query("UPDATE graphics SET url = $2 WHERE id = $1", [id, url]);
};

export const ensureLocalGraphicsSeeded = async () => {
  if (!hasLocalDatabase()) return 0;
  await ensureLocalDatabaseSchema();
  return 0;
};

const ensureLocalGraphicsHistorySeeded = async () => {
  if (!hasLocalDatabase()) return;

  if (!graphicsHistorySeedPromise) {
    graphicsHistorySeedPromise = (async () => {
      await ensureLocalGraphicsSeeded();

      await getPostgresPool().query(
        [
          "DELETE FROM graphics_history",
          "WHERE ctid IN (",
          "  SELECT ctid FROM (",
          "    SELECT ctid, row_number() OVER (PARTITION BY graphic_id ORDER BY created_at ASC, ctid ASC) AS rn",
          "    FROM graphics_history",
          "    WHERE graphic_id IS NOT NULL",
          "  ) duplicates",
          "  WHERE duplicates.rn > 1",
          ")",
        ].join(" ")
      );

      const seeded = await getMigrationState(GRAPHICS_HISTORY_SEEDED_KEY);
      if (seeded === "done") return;

      await getPostgresPool().query(
        [
          "INSERT INTO graphics_history (id, graphic_id, user_id, prompt, style, type, dimensions, created_at)",
          "SELECT gen_random_uuid()::text, g.id, g.user_id, g.prompt, g.style, g.type, g.dimensions, g.created_at",
          "FROM graphics g",
          "WHERE NOT EXISTS (",
          "  SELECT 1 FROM graphics_history h WHERE h.graphic_id = g.id",
          ")",
        ].join(" ")
      );

      await setMigrationState(GRAPHICS_HISTORY_SEEDED_KEY, "done");
    })().finally(() => {
      graphicsHistorySeedPromise = null;
    });
  }

  await graphicsHistorySeedPromise;
};

const queryGraphics = async <T extends LocalGraphicRow>(
  sql: string,
  params: unknown[] = []
) => {
  await ensureLocalGraphicsSeeded();
  const { rows } = await getPostgresPool().query<T>(sql, params);
  return rows.map((row) => mapGraphicRow(row));
};

const queryGraphicsHistory = async (
  sql: string,
  params: unknown[] = []
) => {
  await ensureLocalGraphicsHistorySeeded();
  const { rows } = await getPostgresPool().query<LocalGraphicHistoryRow>(sql, params);
  return rows.map((row) => mapGraphicHistoryRow(row));
};

export const getLocalGraphicById = async (id: string) => {
  const rows = await queryGraphics<LocalGraphicRow>(
    `SELECT ${GRAPHICS_SELECT} FROM graphics WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
};

export const getLocalGraphicByUserAndId = async (userId: string, id: string) => {
  const rows = await queryGraphics<LocalGraphicRow>(
    `SELECT ${GRAPHICS_SELECT} FROM graphics WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [id, userId]
  );

  return rows[0] ?? null;
};

export const getLocalGraphicByPublicToken = async (token: string) => {
  const rows = await queryGraphics<LocalGraphicRow>(
    `SELECT ${GRAPHICS_SELECT} FROM graphics WHERE public_token = $1 LIMIT 1`,
    [token]
  );
  return rows[0] ?? null;
};

export const listLocalGraphicsByUser = async (
  userId: string,
  {
    filter = "all",
    limit = 200,
  }: {
    filter?: GraphicFilter;
    limit?: number;
  } = {}
) => {
  const params: unknown[] = [userId];
  let where = "user_id = $1";

  if (filter !== "all") {
    params.push(filter);
    where += ` AND type = $${params.length}`;
  }

  params.push(limit);

  return queryGraphics<LocalGraphicRow>(
    `SELECT ${GRAPHICS_SELECT} FROM graphics WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
};

export const listAllLocalGraphicsByUser = async (userId: string) => {
  return queryGraphics<LocalGraphicRow>(
    `SELECT ${GRAPHICS_SELECT} FROM graphics WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
};

export const listLocalToolGalleryGraphics = async (userId: string, limit = 24) => {
  return queryGraphics<LocalGraphicRow>(
    `SELECT ${GRAPHICS_SELECT} FROM graphics WHERE user_id = $1 AND url IS NOT NULL ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
};

export const listLocalPublicGraphics = async (limit = 12) => {
  return queryGraphics<LocalGraphicRow>(
    `SELECT ${GRAPHICS_SELECT} FROM graphics WHERE is_public = true ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
};

export const listLocalGraphicsByParentId = async (parentId: string, userId?: string | null) => {
  if (userId) {
    return queryGraphics<LocalGraphicRow>(
      `SELECT ${GRAPHICS_SELECT} FROM graphics WHERE parent_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [parentId, userId]
    );
  }

  return queryGraphics<LocalGraphicRow>(
    `SELECT ${GRAPHICS_SELECT} FROM graphics WHERE parent_id = $1 ORDER BY created_at ASC`,
    [parentId]
  );
};

export const listLocalGraphicsByIdsForUser = async (userId: string, ids: string[]) => {
  if (!ids.length) return [] as LocalGraphicRow[];

  return queryGraphics<LocalGraphicRow>(
    `SELECT ${GRAPHICS_SELECT} FROM graphics WHERE user_id = $1 AND id = ANY($2::text[])`,
    [userId, ids]
  );
};

export const createLocalGraphic = async (row: {
  user_id: string;
  url: string | null;
  prompt: string;
  style: string;
  type: string;
  dimensions?: string | null;
  parent_id?: string | null;
}) => {
  const [created] = await upsertLocalGraphicsRows([
    {
      id: randomUUID(),
      user_id: row.user_id,
      url: row.url,
      prompt: row.prompt,
      style: row.style,
      type: row.type,
      dimensions: row.dimensions ?? null,
      created_at: new Date().toISOString(),
      public_token: null,
      is_public: false,
      parent_id: row.parent_id ?? null,
    },
  ]);

  return created;
};

export const trimLocalSavedGraphics = async (userId: string, keep = 50) => {
  await ensureLocalGraphicsSeeded();
  const { rows } = await getPostgresPool().query<Pick<LocalGraphicRow, "id" | "url">>(
    [
      "SELECT id, url FROM graphics",
      "WHERE user_id = $1",
      "ORDER BY created_at DESC",
      "OFFSET $2",
    ].join(" "),
    [userId, keep]
  );

  if (!rows.length) return [] as Pick<LocalGraphicRow, "id" | "url">[];

  await getPostgresPool().query("DELETE FROM graphics WHERE id = ANY($1::text[])", [
    rows.map((row) => row.id),
  ]);

  return rows;
};

export const deleteLocalGraphicsByIds = async (ids: string[]) => {
  if (!ids.length || !hasLocalDatabase()) return;

  await ensureLocalGraphicsSeeded();
  await getPostgresPool().query("DELETE FROM graphics WHERE id = ANY($1::text[])", [ids]);
};

export const setLocalGraphicPublic = async (id: string, userId: string, isPublic: boolean) => {
  await ensureLocalGraphicsSeeded();
  const { rows } = await getPostgresPool().query<LocalGraphicRow>(
    [
      "UPDATE graphics",
      "SET is_public = $3",
      "WHERE id = $1 AND user_id = $2",
      `RETURNING ${GRAPHICS_SELECT}`,
    ].join(" "),
    [id, userId, isPublic]
  );

  return rows[0] ? mapGraphicRow(rows[0]) : null;
};

export const ensureLocalGraphicShareToken = async (id: string, userId: string) => {
  const existing = await getLocalGraphicByUserAndId(userId, id);
  if (!existing) return null;
  if (existing.public_token) return existing.public_token;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomUUID().replace(/-/g, "").slice(0, 16);
    const { rowCount } = await getPostgresPool().query(
      [
        "UPDATE graphics",
        "SET public_token = $3",
        "WHERE id = $1 AND user_id = $2 AND public_token IS NULL",
      ].join(" "),
      [id, userId, token]
    );

    if (rowCount) return token;

    const current = await getLocalGraphicByUserAndId(userId, id);
    if (current?.public_token) return current.public_token;
  }

  throw new Error("Nie udalo sie utworzyc tokenu udostepnienia.");
};

export const hideLocalGraphicById = async (id: string) => {
  await ensureLocalGraphicsSeeded();
  const { rows } = await getPostgresPool().query<Pick<LocalGraphicRow, "id">>(
    "UPDATE graphics SET is_public = false WHERE id = $1 RETURNING id",
    [id]
  );
  return Boolean(rows[0]);
};

export const getLocalGraphicsCount = async () => {
  await ensureLocalGraphicsSeeded();
  return countLocalGraphics();
};

export const recordLocalGraphicHistoryEntry = async (row: {
  graphic_id?: string | null;
  user_id?: string | null;
  prompt?: string;
  style?: string;
  type?: string;
  dimensions?: string | null;
  created_at?: string | null;
}) => {
  if (!hasLocalDatabase()) return null;

  await ensureLocalGraphicsHistorySeeded();
  const normalized = mapGraphicHistoryRow({
    id: randomUUID(),
    graphic_id: row.graphic_id ?? null,
    user_id: row.user_id ?? null,
    prompt: row.prompt ?? "",
    style: row.style ?? "",
    type: row.type ?? "generated",
    dimensions: row.dimensions ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
  });

  const { rows } = await getPostgresPool().query<LocalGraphicHistoryRow>(
    [
      "INSERT INTO graphics_history (id, graphic_id, user_id, prompt, style, type, dimensions, created_at)",
      "SELECT $1, $2, $3, $4, $5, $6, $7, $8",
      "WHERE NOT EXISTS (",
      "  SELECT 1 FROM graphics_history WHERE graphic_id IS NOT DISTINCT FROM $2",
      ")",
      `RETURNING ${GRAPHICS_HISTORY_SELECT}`,
    ].join(" "),
    [
      normalized.id,
      normalized.graphic_id,
      normalized.user_id,
      normalized.prompt,
      normalized.style,
      normalized.type,
      normalized.dimensions,
      normalized.created_at,
    ]
  );

  if (rows[0]) {
    return mapGraphicHistoryRow(rows[0]);
  }

  if (normalized.graphic_id) {
    const existingRows = await getPostgresPool().query<LocalGraphicHistoryRow>(
      `SELECT ${GRAPHICS_HISTORY_SELECT} FROM graphics_history WHERE graphic_id = $1 LIMIT 1`,
      [normalized.graphic_id]
    );
    if (existingRows.rows[0]) {
      return mapGraphicHistoryRow(existingRows.rows[0]);
    }
  }

  return normalized;
};

export const getLocalGraphicsHistoryCount = async () => {
  await ensureLocalGraphicsHistorySeeded();
  return countLocalGraphicsHistory();
};

export const getLocalGraphicsCountSince = async (since: string) => {
  await ensureLocalGraphicsSeeded();
  const { rows } = await getPostgresPool().query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM graphics WHERE created_at >= $1",
    [since]
  );
  return Number(rows[0]?.count || 0);
};

export const getLocalGraphicsHistoryCountSince = async (since: string) => {
  await ensureLocalGraphicsHistorySeeded();
  const { rows } = await getPostgresPool().query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM graphics_history WHERE created_at >= $1",
    [since]
  );
  return Number(rows[0]?.count || 0);
};

export const listLocalGraphicsCreatedSince = async (since: string) => {
  return queryGraphics<LocalGraphicRow>(
    `SELECT ${GRAPHICS_SELECT} FROM graphics WHERE created_at >= $1 ORDER BY created_at ASC`,
    [since]
  );
};

export const listLocalGraphicsHistoryCreatedSince = async (since: string) => {
  return queryGraphicsHistory(
    `SELECT ${GRAPHICS_HISTORY_SELECT} FROM graphics_history WHERE created_at >= $1 ORDER BY created_at ASC`,
    [since]
  );
};

export const listLocalGraphicStyles = async () => {
  await ensureLocalGraphicsSeeded();
  const { rows } = await getPostgresPool().query<{ style: string | null }>("SELECT style FROM graphics");
  return rows.map((row) => row.style ?? "brak");
};

export const listLocalGraphicsHistoryStyles = async () => {
  await ensureLocalGraphicsHistorySeeded();
  const { rows } = await getPostgresPool().query<{ style: string | null }>(
    "SELECT style FROM graphics_history"
  );
  return rows.map((row) => row.style ?? "brak");
};
