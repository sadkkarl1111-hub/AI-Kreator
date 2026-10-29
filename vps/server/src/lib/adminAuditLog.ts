import { ensureLocalDatabaseSchema, getPostgresPool, hasLocalDatabase } from "./postgres.js";

export type AdminAuditSeverity = "info" | "warning" | "critical";

export type AdminAuditLogInput = {
  eventKey: string;
  title: string;
  severity?: AdminAuditSeverity;
  actorUserId?: string | null;
  actorEmail?: string | null;
  targetUserId?: string | null;
  targetEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
};

export type AdminAuditLogRow = {
  id: string;
  event_key: string;
  title: string;
  severity: AdminAuditSeverity;
  actor_user_id: string | null;
  actor_email: string | null;
  target_user_id: string | null;
  target_email: string | null;
  ip: string | null;
  user_agent: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

const normalizeLimit = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 300;
  return Math.max(1, Math.min(1000, Math.floor(parsed)));
};

export const recordAdminAuditLog = async (input: AdminAuditLogInput) => {
  if (!hasLocalDatabase()) return null;

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<AdminAuditLogRow>(
    [
      "INSERT INTO admin_audit_logs",
      "(event_key, title, severity, actor_user_id, actor_email, target_user_id, target_email, ip, user_agent, details)",
      "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)",
      "RETURNING id, event_key, title, severity, actor_user_id, actor_email, target_user_id, target_email, ip, user_agent, details, created_at::text",
    ].join(" "),
    [
      input.eventKey,
      input.title,
      input.severity || "warning",
      input.actorUserId || null,
      input.actorEmail || null,
      input.targetUserId || null,
      input.targetEmail || null,
      input.ip || null,
      input.userAgent || null,
      JSON.stringify(input.details || {}),
    ],
  );

  return rows[0] || null;
};

export const listAdminAuditLogs = async (options: {
  limit?: unknown;
  search?: unknown;
  severity?: unknown;
} = {}) => {
  if (!hasLocalDatabase()) return [];

  await ensureLocalDatabaseSchema();
  const limit = normalizeLimit(options.limit);
  const search = typeof options.search === "string" ? options.search.trim().toLowerCase() : "";
  const severity = typeof options.severity === "string" ? options.severity.trim().toLowerCase() : "";
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (severity && severity !== "all") {
    values.push(severity);
    conditions.push(`severity = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      [
        "(",
        "LOWER(title) LIKE $" + values.length,
        "OR LOWER(event_key) LIKE $" + values.length,
        "OR LOWER(COALESCE(actor_email, '')) LIKE $" + values.length,
        "OR LOWER(COALESCE(target_email, '')) LIKE $" + values.length,
        "OR LOWER(COALESCE(ip, '')) LIKE $" + values.length,
        "OR LOWER(details::text) LIKE $" + values.length,
        ")",
      ].join(" "),
    );
  }

  values.push(limit);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await getPostgresPool().query<AdminAuditLogRow>(
    [
      "SELECT id, event_key, title, severity, actor_user_id, actor_email, target_user_id, target_email, ip, user_agent, details, created_at::text",
      "FROM admin_audit_logs",
      where,
      "ORDER BY created_at DESC",
      `LIMIT $${values.length}`,
    ].join(" "),
    values,
  );

  return rows;
};

export const clearAdminAuditLogsOlderThan = async (retentionDays: unknown) => {
  if (!hasLocalDatabase()) return 0;

  const days = Math.max(1, Math.min(3650, Math.floor(Number(retentionDays) || 90)));
  await ensureLocalDatabaseSchema();
  const { rowCount } = await getPostgresPool().query(
    "DELETE FROM admin_audit_logs WHERE created_at < now() - ($1::int * interval '1 day')",
    [days],
  );

  return rowCount || 0;
};
