import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { ensureLocalDatabaseSchema, getPostgresPool, hasLocalDatabase } from "./postgres.js";

export type GenerationJobTier = "free" | "paid" | "admin";
export type GenerationJobType = "generate-image" | "edit-image" | "image-to-prompt" | "ocr";
export type GenerationJobStatus = "completed" | "failed" | "cancelled";

export class GenerationConcurrencyError extends Error {
  status = 429;
  limit: number;
  activeCount: number;

  constructor(limit: number, activeCount: number) {
    super(`Masz juz ${activeCount} aktywne generowania. Limit dla konta: ${limit}. Poczekaj az poprzednie zadanie sie zakonczy.`);
    this.limit = limit;
    this.activeCount = activeCount;
  }
}

const getLimitForTier = (tier: GenerationJobTier) => {
  if (tier === "admin") return Number.POSITIVE_INFINITY;
  if (tier === "paid") return Math.max(Math.floor(Number(env.paidConcurrentGenerationLimit) || 0), 1);
  return Math.max(Math.floor(Number(env.freeConcurrentGenerationLimit) || 0), 1);
};

const cleanupStaleJobsSql = () => [
  "UPDATE generation_jobs",
  "SET status = 'cancelled', updated_at = now(), finished_at = COALESCE(finished_at, now())",
  "WHERE status = 'running'",
  "AND created_at < now() - ($1::int * interval '1 second')",
].join(" ");

export const reserveGenerationJob = async ({
  userId,
  tier,
  jobType,
  cost,
  model,
}: {
  userId: string;
  tier: GenerationJobTier;
  jobType: GenerationJobType;
  cost?: number;
  model?: string;
}) => {
  const limit = getLimitForTier(tier);
  if (!Number.isFinite(limit)) return null;
  if (!hasLocalDatabase()) return null;

  await ensureLocalDatabaseSchema();
  const pool = getPostgresPool();
  const client = await pool.connect();
  const jobId = randomUUID();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [userId]);
    await client.query(cleanupStaleJobsSql(), [Math.max(Math.floor(Number(env.generationJobTtlSeconds) || 1800), 60)]);

    const { rows } = await client.query<{ active_count: string }>(
      "SELECT COUNT(*)::text AS active_count FROM generation_jobs WHERE user_id = $1 AND status = 'running'",
      [userId],
    );
    const activeCount = Number(rows[0]?.active_count || 0);

    if (activeCount >= limit) {
      await client.query("ROLLBACK");
      throw new GenerationConcurrencyError(limit, activeCount);
    }

    await client.query(
      [
        "INSERT INTO generation_jobs (id, user_id, job_type, status, cost, model)",
        "VALUES ($1, $2, $3, 'running', $4, $5)",
      ].join(" "),
      [jobId, userId, jobType, Math.max(Math.floor(Number(cost) || 0), 0), model || ""],
    );

    await client.query("COMMIT");
    return jobId;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
};

export const finishGenerationJob = async (jobId: string | null, status: GenerationJobStatus) => {
  if (!jobId || !hasLocalDatabase()) return;

  await ensureLocalDatabaseSchema();
  await getPostgresPool().query(
    [
      "UPDATE generation_jobs",
      "SET status = $2, updated_at = now(), finished_at = now()",
      "WHERE id = $1 AND status = 'running'",
    ].join(" "),
    [jobId, status],
  );
};
