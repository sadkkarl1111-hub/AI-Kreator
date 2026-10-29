import { randomUUID } from "crypto";
import { getPostgresPool, hasLocalDatabase } from "./postgres.js";

export type SavedAdPrompt = {
  title: string;
  hookPl: string;
  prompt: string;
  needsImage: boolean;
  imageNote: string;
};

export type AdPromptSessionInput = {
  userId: string;
  inputText: string;
  imageCount: number;
  prompts: SavedAdPrompt[];
};

export type AdPromptSessionRow = {
  id: string;
  user_id: string;
  input_text: string;
  image_count: number;
  prompts: SavedAdPrompt[];
  created_at: string;
};

export const createLocalAdPromptSession = async (input: AdPromptSessionInput) => {
  if (!hasLocalDatabase()) return null;

  const id = randomUUID();
  const { rows } = await getPostgresPool().query<AdPromptSessionRow>(
    `
      INSERT INTO ad_prompt_sessions (id, user_id, input_text, image_count, prompts)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING id, user_id, input_text, image_count, prompts, created_at
    `,
    [
      id,
      input.userId,
      String(input.inputText || "").slice(0, 12000),
      Math.max(0, Math.min(Number(input.imageCount || 0), 20)),
      JSON.stringify(Array.isArray(input.prompts) ? input.prompts : []),
    ],
  );

  return rows[0] || null;
};

export const listLocalAdPromptSessions = async (userId: string, limit = 30) => {
  if (!hasLocalDatabase()) return [] as AdPromptSessionRow[];

  const { rows } = await getPostgresPool().query<AdPromptSessionRow>(
    `
      SELECT id, user_id, input_text, image_count, prompts, created_at
      FROM ad_prompt_sessions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, Math.min(Math.max(limit, 1), 100)],
  );

  return rows;
};

export const deleteLocalAdPromptSessionForUser = async (userId: string, sessionId: string) => {
  if (!hasLocalDatabase()) return false;
  const { rowCount } = await getPostgresPool().query("DELETE FROM ad_prompt_sessions WHERE user_id = $1 AND id = $2", [
    userId,
    sessionId,
  ]);
  return (rowCount || 0) > 0;
};

export const deleteLocalAdPromptSessionsByUserId = async (userId: string) => {
  if (!hasLocalDatabase()) return;
  await getPostgresPool().query("DELETE FROM ad_prompt_sessions WHERE user_id = $1", [userId]);
};
