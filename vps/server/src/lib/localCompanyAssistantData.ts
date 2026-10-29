import { randomUUID } from "crypto";
import { getPostgresPool, hasLocalDatabase } from "./postgres.js";

export type CompanyAssistantPrompt = {
  materialId: string;
  title: string;
  format: string;
  style: string;
  prompt: string;
};

export type CompanyAssistantPackageInput = {
  userId: string;
  companyName: string;
  industry: string;
  profile: Record<string, unknown>;
  prompts: CompanyAssistantPrompt[];
};

export type CompanyAssistantPackageRow = {
  id: string;
  user_id: string;
  company_name: string;
  industry: string;
  profile: Record<string, unknown>;
  prompts: CompanyAssistantPrompt[];
  created_at: string;
  updated_at: string;
};

export type CompanyAssistantAssetInput = {
  userId: string;
  packageId?: string | null;
  sessionId?: string | null;
  graphicId?: string | null;
  url?: string | null;
  materialId?: string;
  materialTitle?: string;
  assetType?: string;
  prompt?: string;
  dimensions?: string | null;
};

export type CompanyAssistantAssetRow = {
  id: string;
  user_id: string;
  package_id: string | null;
  session_id: string | null;
  graphic_id: string | null;
  url: string | null;
  material_id: string;
  material_title: string;
  asset_type: string;
  prompt: string;
  dimensions: string | null;
  created_at: string;
};

export const listLocalCompanyAssistantPackages = async (userId: string, limit = 20) => {
  if (!hasLocalDatabase()) return [];

  const pool = getPostgresPool();
  const { rows } = await pool.query<CompanyAssistantPackageRow>(
    `
      SELECT id, user_id, company_name, industry, profile, prompts, created_at, updated_at
      FROM company_assistant_packages
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, Math.min(Math.max(limit, 1), 50)],
  );

  return rows;
};

export const listLocalCompanyAssistantAssets = async (
  userId: string,
  options: { packageId?: string | null; sessionId?: string | null; limit?: number } = {},
) => {
  if (!hasLocalDatabase()) return [] as CompanyAssistantAssetRow[];

  const where = ["user_id = $1"];
  const params: Array<string | number> = [userId];

  if (options.packageId) {
    params.push(options.packageId);
    where.push(`package_id = $${params.length}`);
  }

  if (options.sessionId) {
    params.push(options.sessionId);
    where.push(`session_id = $${params.length}`);
  }

  params.push(Math.min(Math.max(options.limit ?? 50, 1), 100));

  const { rows } = await getPostgresPool().query<CompanyAssistantAssetRow>(
    `
      SELECT id, user_id, package_id, session_id, graphic_id, url, material_id, material_title,
             asset_type, prompt, dimensions, created_at
      FROM company_assistant_assets
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${params.length}
    `,
    params,
  );

  return rows;
};

export const createLocalCompanyAssistantAsset = async (input: CompanyAssistantAssetInput) => {
  if (!hasLocalDatabase()) return null;

  const id = randomUUID();
  const { rows } = await getPostgresPool().query<CompanyAssistantAssetRow>(
    `
      INSERT INTO company_assistant_assets (
        id, user_id, package_id, session_id, graphic_id, url, material_id, material_title,
        asset_type, prompt, dimensions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, user_id, package_id, session_id, graphic_id, url, material_id, material_title,
                asset_type, prompt, dimensions, created_at
    `,
    [
      id,
      input.userId,
      input.packageId || null,
      input.sessionId || null,
      input.graphicId || null,
      input.url || null,
      String(input.materialId || "").slice(0, 100),
      String(input.materialTitle || "").slice(0, 200),
      String(input.assetType || "generated").slice(0, 80),
      String(input.prompt || ""),
      input.dimensions || null,
    ],
  );

  return rows[0] || null;
};

export const createLocalCompanyAssistantPackage = async (input: CompanyAssistantPackageInput) => {
  if (!hasLocalDatabase()) {
    throw new Error("Local database is required for company assistant packages.");
  }

  const pool = getPostgresPool();
  const profile = input.profile || {};
  const profileSessionId = typeof profile.sessionId === "string" ? profile.sessionId.trim() : "";

  if (profileSessionId) {
    const { rows } = await pool.query<CompanyAssistantPackageRow>(
      `
        UPDATE company_assistant_packages
        SET company_name = $3,
            industry = $4,
            profile = $5::jsonb,
            prompts = $6::jsonb,
            updated_at = now()
        WHERE user_id = $1 AND profile->>'sessionId' = $2
        RETURNING id, user_id, company_name, industry, profile, prompts, created_at, updated_at
      `,
      [
        input.userId,
        profileSessionId,
        input.companyName,
        input.industry,
        JSON.stringify(profile),
        JSON.stringify(Array.isArray(input.prompts) ? input.prompts : []),
      ],
    );

    if (rows[0]) return rows[0];
  }

  const id = randomUUID();
  const { rows } = await pool.query<CompanyAssistantPackageRow>(
    `
      INSERT INTO company_assistant_packages (id, user_id, company_name, industry, profile, prompts)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      RETURNING id, user_id, company_name, industry, profile, prompts, created_at, updated_at
    `,
    [
      id,
      input.userId,
      input.companyName,
      input.industry,
      JSON.stringify(profile),
      JSON.stringify(Array.isArray(input.prompts) ? input.prompts : []),
    ],
  );

  return rows[0];
};

export const deleteLocalCompanyAssistantPackageForUser = async (userId: string, packageId: string) => {
  if (!hasLocalDatabase()) return false;
  const pool = getPostgresPool();
  const { rowCount } = await pool.query(
    "DELETE FROM company_assistant_packages WHERE user_id = $1 AND id = $2",
    [userId, packageId],
  );
  await pool.query("DELETE FROM company_assistant_assets WHERE user_id = $1 AND package_id = $2", [userId, packageId]);
  return (rowCount || 0) > 0;
};

export const deleteLocalCompanyAssistantAssetForUser = async (userId: string, assetId: string) => {
  if (!hasLocalDatabase()) return false;
  const { rowCount } = await getPostgresPool().query(
    "DELETE FROM company_assistant_assets WHERE user_id = $1 AND id = $2",
    [userId, assetId],
  );
  return (rowCount || 0) > 0;
};

export const deleteLocalCompanyAssistantPackagesByUserId = async (userId: string) => {
  if (!hasLocalDatabase()) return;
  await getPostgresPool().query("DELETE FROM company_assistant_packages WHERE user_id = $1", [userId]);
  await getPostgresPool().query("DELETE FROM company_assistant_assets WHERE user_id = $1", [userId]);
};
