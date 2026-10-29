import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), applied: false }));
vi.mock('../../vps/server/src/lib/postgres.js', () => ({
  ensureLocalDatabaseSchema: vi.fn(),
  hasLocalDatabase: () => true,
  getPostgresPool: () => ({
    query: db.query,
    connect: async () => ({ query: db.query, release: db.release }),
  }),
}));

import { refreshLocalAiModelCatalog } from '../../vps/server/src/lib/localCoreData';

describe('GPT Image 2.5 catalog migration', () => {
  beforeEach(() => {
    db.applied = false;
    db.query.mockReset();
    db.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('SELECT value')) {
        return { rows: params?.[0] === 'ai_model_openai_gpt_image_25_v1' && !db.applied ? [] : [{ value: 'done' }] };
      }
      if (sql.startsWith('INSERT INTO migration_state')) db.applied = true;
      return { rows: [], rowCount: sql.startsWith('INSERT INTO ai_models') ? 1 : 0 };
    });
  });

  it('adds both variants without updating or disabling existing models and runs only once', async () => {
    expect(await refreshLocalAiModelCatalog()).toEqual({ ok: true, skipped: false, updated: 2 });
    const inserts = db.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO ai_models'));
    expect(inserts.map(([, params]) => params)).toEqual([
      ['Flare', 'openai-gpt-image-2.5-flare', 'gpt-image-2.5-flare', 5],
      ['Sunburst', 'openai-gpt-image-2.5-sunburst', 'gpt-image-2.5-sunburst', 6],
    ]);
    expect(inserts.every(([sql]) => sql.includes('ON CONFLICT (model_id) DO NOTHING'))).toBe(true);
    expect(db.query.mock.calls.some(([sql]) => /^(UPDATE|DELETE) ai_models/.test(sql))).toBe(false);
    db.query.mockClear();
    expect(await refreshLocalAiModelCatalog()).toEqual({ ok: true, skipped: true, updated: 0 });
    expect(db.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
  });

  it('rolls back and leaves the migration pending when an insert fails', async () => {
    db.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('SELECT value')) return { rows: params?.[0] === 'ai_model_openai_gpt_image_25_v1' ? [] : [{ value: 'done' }] };
      if (sql.startsWith('INSERT INTO ai_models')) throw new Error('Database unavailable');
      return { rows: [] };
    });
    await expect(refreshLocalAiModelCatalog()).rejects.toThrow('Database unavailable');
    expect(db.query).toHaveBeenCalledWith('ROLLBACK');
    expect(db.query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO migration_state'))).toBe(false);
  });
});
