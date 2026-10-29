import { randomUUID } from "crypto";
import { getPostgresPool, hasLocalDatabase } from "./postgres.js";

export type CompanyAssistantSessionStatus = "in_progress" | "completed" | "abandoned";

export type CompanyAssistantAnswer = {
  field: string;
  question: string;
  answer: string;
};

export type CompanyAssistantSessionInput = {
  userId: string;
  description?: string;
  analysis?: Record<string, unknown>;
  answers?: CompanyAssistantAnswer[];
  profile?: Record<string, unknown>;
  selectedTheme?: string;
  customColors?: string;
  status?: CompanyAssistantSessionStatus;
};

export type CompanyAssistantSessionRow = {
  id: string;
  user_id: string;
  status: CompanyAssistantSessionStatus;
  description: string;
  analysis: Record<string, unknown>;
  answers: CompanyAssistantAnswer[];
  profile: Record<string, unknown>;
  selected_theme: string;
  custom_colors: string;
  created_at: string;
  updated_at: string;
};

export const createLocalCompanyAssistantSession = async (input: CompanyAssistantSessionInput) => {
  if (!hasLocalDatabase()) {
    throw new Error("Local database is required for company assistant sessions.");
  }

  const pool = getPostgresPool();
  const id = randomUUID();
  const { rows } = await pool.query<CompanyAssistantSessionRow>(
    `
      INSERT INTO company_assistant_sessions
        (id, user_id, status, description, analysis, answers, profile, selected_theme, custom_colors)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)
      RETURNING id, user_id, status, description, analysis, answers, profile, selected_theme, custom_colors, created_at, updated_at
    `,
    [
      id,
      input.userId,
      input.status || "in_progress",
      input.description || "",
      JSON.stringify(input.analysis || {}),
      JSON.stringify(Array.isArray(input.answers) ? input.answers : []),
      JSON.stringify(input.profile || {}),
      input.selectedTheme || "",
      input.customColors || "",
    ],
  );

  return rows[0];
};

export const getLocalCompanyAssistantSession = async (userId: string, sessionId: string) => {
  if (!hasLocalDatabase()) return null;

  const { rows } = await getPostgresPool().query<CompanyAssistantSessionRow>(
    `
      SELECT id, user_id, status, description, analysis, answers, profile, selected_theme, custom_colors, created_at, updated_at
      FROM company_assistant_sessions
      WHERE user_id = $1 AND id = $2
      LIMIT 1
    `,
    [userId, sessionId],
  );

  return rows[0] || null;
};

export const updateLocalCompanyAssistantSession = async (
  userId: string,
  sessionId: string,
  patch: Partial<Omit<CompanyAssistantSessionInput, "userId">>,
) => {
  if (!hasLocalDatabase()) {
    throw new Error("Local database is required for company assistant sessions.");
  }

  const current = await getLocalCompanyAssistantSession(userId, sessionId);
  if (!current) return null;

  const next = {
    status: patch.status || current.status,
    description: patch.description ?? current.description,
    analysis: patch.analysis || current.analysis || {},
    answers: Array.isArray(patch.answers) ? patch.answers : current.answers || [],
    profile: patch.profile || current.profile || {},
    selectedTheme: patch.selectedTheme ?? current.selected_theme ?? "",
    customColors: patch.customColors ?? current.custom_colors ?? "",
  };

  const { rows } = await getPostgresPool().query<CompanyAssistantSessionRow>(
    `
      UPDATE company_assistant_sessions
      SET status = $3,
          description = $4,
          analysis = $5::jsonb,
          answers = $6::jsonb,
          profile = $7::jsonb,
          selected_theme = $8,
          custom_colors = $9,
          updated_at = now()
      WHERE user_id = $1 AND id = $2
      RETURNING id, user_id, status, description, analysis, answers, profile, selected_theme, custom_colors, created_at, updated_at
    `,
    [
      userId,
      sessionId,
      next.status,
      next.description,
      JSON.stringify(next.analysis),
      JSON.stringify(next.answers),
      JSON.stringify(next.profile),
      next.selectedTheme,
      next.customColors,
    ],
  );

  return rows[0] || null;
};

export const deleteLocalCompanyAssistantSessionsByUserId = async (userId: string) => {
  if (!hasLocalDatabase()) return;
  await getPostgresPool().query("DELETE FROM company_assistant_sessions WHERE user_id = $1", [userId]);
};
