import { Pool } from "pg";
import { env } from "../config/env.js";

let pool: Pool | null = null;
let schemaPromise: Promise<void> | null = null;

const CORE_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ad_ai_weekly_limits (
  scope TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  used_at TIMESTAMPTZ NULL,
  PRIMARY KEY (scope, subject_key)
);

CREATE TABLE IF NOT EXISTS ad_ai_usage (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  usage_available BOOLEAN NOT NULL DEFAULT false,
  input_tokens INTEGER NULL,
  cached_input_tokens INTEGER NULL,
  cache_write_tokens INTEGER NULL,
  output_tokens INTEGER NULL,
  reasoning_tokens INTEGER NULL,
  estimated_cost_usd NUMERIC(18,8) NULL,
  rates JSONB NOT NULL,
  min_credit_value_pln NUMERIC(18,8) NULL,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS ad_ai_usage_created_idx ON ad_ai_usage(created_at);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS migration_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL
);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  html_content TEXT NOT NULL DEFAULT '',
  variables TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  model_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'custom',
  api_model TEXT NULL,
  credit_cost INTEGER NOT NULL DEFAULT 50,
  active BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  supports_generation BOOLEAN NOT NULL DEFAULT true,
  supports_editing BOOLEAN NOT NULL DEFAULT true,
  supports_reference_images BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tool_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  credit_cost INTEGER NOT NULL DEFAULT 50,
  active BOOLEAN NOT NULL DEFAULT true,
  access_tier TEXT NOT NULL DEFAULT 'all',
  visible BOOLEAN NOT NULL DEFAULT true,
  popular BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tool_pricing (tool_id, label, credit_cost, active, access_tier, visible, popular)
VALUES ('badge-editor', 'Edytor badge''ów AI', 50, true, 'all', true, true)
ON CONFLICT (tool_id) DO NOTHING;

INSERT INTO tool_pricing (tool_id, label, credit_cost, active, access_tier, visible, popular)
VALUES ('svg-generator', 'Generator SVG z prompta', 10, true, 'all', true, false)
ON CONFLICT (tool_id) DO NOTHING;

INSERT INTO tool_pricing (tool_id, label, credit_cost, active, access_tier, visible, popular)
VALUES ('vectorize', 'PNG / JPG → SVG', 0, true, 'all', true, false),
       ('text-effects', 'Napisy z efektami', 0, true, 'all', true, false)
ON CONFLICT (tool_id) DO NOTHING;

INSERT INTO tool_pricing (tool_id, label, credit_cost, active, access_tier, visible, popular)
VALUES ('carousel', 'Kreator karuzel', 0, true, 'all', true, false),
       ('print-preparation', 'Przygotowanie do druku', 0, true, 'all', true, false)
ON CONFLICT (tool_id) DO NOTHING;

INSERT INTO tool_pricing (tool_id, label, credit_cost, active, access_tier, visible, popular)
VALUES ('batch-images', 'Edycja wielu zdjęć', 0, true, 'all', true, false)
ON CONFLICT (tool_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS credit_packages (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  credits INTEGER NOT NULL DEFAULT 0,
  price_grosze INTEGER NOT NULL DEFAULT 0,
  popular BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_packages_sort_order_idx ON credit_packages (sort_order, created_at);

CREATE TABLE IF NOT EXISTS credit_purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_provider TEXT NULL,
  payment_session_id TEXT NULL,
  payment_order_id TEXT NULL,
  stripe_session_id TEXT NULL UNIQUE,
  payu_order_id TEXT NULL UNIQUE,
  billing_type TEXT NULL,
  billing_name TEXT NULL,
  billing_nip TEXT NULL,
  billing_company TEXT NULL,
  billing_address TEXT NULL,
  billing_postal_code TEXT NULL,
  billing_city TEXT NULL,
  ksef_reference_number TEXT NULL,
  ksef_invoice_number TEXT NULL,
  ksef_session_reference_number TEXT NULL,
  ksef_environment TEXT NULL,
  ksef_sent_at TIMESTAMPTZ NULL,
  ksef_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE credit_purchases
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NULL;

ALTER TABLE credit_purchases
  ADD COLUMN IF NOT EXISTS payment_session_id TEXT NULL;

ALTER TABLE credit_purchases
  ADD COLUMN IF NOT EXISTS payment_order_id TEXT NULL;

ALTER TABLE credit_purchases
  ADD COLUMN IF NOT EXISTS payu_order_id TEXT NULL;

UPDATE credit_purchases
SET payment_session_id = stripe_session_id
WHERE payment_session_id IS NULL
  AND stripe_session_id IS NOT NULL;

UPDATE credit_purchases
SET payment_order_id = payu_order_id
WHERE payment_order_id IS NULL
  AND payu_order_id IS NOT NULL;

UPDATE credit_purchases
SET payment_provider = 'payu'
WHERE payment_provider IS NULL
  AND (payment_order_id IS NOT NULL OR payu_order_id IS NOT NULL OR stripe_session_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS credit_purchases_user_id_idx ON credit_purchases (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_purchases_status_idx ON credit_purchases (status, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_purchases_payment_session_idx ON credit_purchases (payment_session_id);
CREATE INDEX IF NOT EXISTS credit_purchases_payment_order_idx ON credit_purchases (payment_order_id);
CREATE INDEX IF NOT EXISTS credit_purchases_session_idx ON credit_purchases (stripe_session_id);
CREATE INDEX IF NOT EXISTS credit_purchases_payu_order_idx ON credit_purchases (payu_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS credit_purchases_payment_session_unique_idx
  ON credit_purchases (payment_session_id)
  WHERE payment_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS credit_purchases_payment_order_unique_idx
  ON credit_purchases (payment_order_id)
  WHERE payment_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS credit_purchases_payu_order_unique_idx
  ON credit_purchases (payu_order_id)
  WHERE payu_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS credit_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_usage_user_id_idx ON credit_usage (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'generation',
  status TEXT NOT NULL DEFAULT 'running',
  cost INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS generation_jobs_user_status_idx
  ON generation_jobs (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS generation_jobs_status_created_idx
  ON generation_jobs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS invoice_settings (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT '',
  nip TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mailerlite_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mailerlite_package_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id TEXT NOT NULL UNIQUE,
  group_id TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mailerlite_package_groups_group_id_idx
  ON mailerlite_package_groups (group_id);

CREATE TABLE IF NOT EXISTS admin_emoji_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  label TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_emojis (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category_id TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_emojis_category_sort_idx
  ON admin_emojis (category_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS admin_badges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Inne',
  storage_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_badges_sort_idx
  ON admin_badges (sort_order, created_at);

CREATE TABLE IF NOT EXISTS hidden_static_badges (
  badge_key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS badge_package_access (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  badge_key TEXT NOT NULL,
  package_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (badge_key, package_id)
);

CREATE INDEX IF NOT EXISTS badge_package_access_badge_idx
  ON badge_package_access (badge_key, package_id);

CREATE TABLE IF NOT EXISTS error_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source TEXT NOT NULL DEFAULT 'api',
  message TEXT NOT NULL DEFAULT '',
  stack TEXT NULL,
  context JSONB NULL,
  user_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_logs_created_at_idx
  ON error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_user_id_idx
  ON error_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_source_idx
  ON error_logs (source, created_at DESC);

CREATE TABLE IF NOT EXISTS favorite_emojis (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, emoji)
);

CREATE INDEX IF NOT EXISTS favorite_emojis_user_idx
  ON favorite_emojis (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  email TEXT NULL,
  display_name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_users (
  user_id TEXT PRIMARY KEY,
  email TEXT NULL,
  email_confirmed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NULL,
  last_sign_in_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_local_credentials (
  user_id TEXT PRIMARY KEY,
  email TEXT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_algorithm TEXT NOT NULL DEFAULT 'scrypt',
  password_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  migrated_from TEXT NOT NULL DEFAULT 'vps'
);

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  replaced_by_token_id UUID NULL
);

CREATE INDEX IF NOT EXISTS auth_refresh_tokens_user_id_idx ON auth_refresh_tokens (user_id);

CREATE TABLE IF NOT EXISTS auth_password_reset_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS auth_password_reset_tokens_user_id_idx ON auth_password_reset_tokens (user_id);

CREATE TABLE IF NOT EXISTS auth_email_confirmation_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS auth_email_confirmation_tokens_user_id_idx
  ON auth_email_confirmation_tokens (user_id);

CREATE TABLE IF NOT EXISTS auth_user_totp (
  user_id TEXT PRIMARY KEY,
  secret_encrypted TEXT NOT NULL,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_step BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_user_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, code_hash)
);

CREATE INDEX IF NOT EXISTS auth_user_recovery_codes_user_idx
  ON auth_user_recovery_codes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS security_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_alert_events_key_sent_idx
  ON security_alert_events (event_key, sent_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  actor_user_id TEXT NULL,
  actor_email TEXT NULL,
  target_user_id TEXT NULL,
  target_email TEXT NULL,
  ip TEXT NULL,
  user_agent TEXT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx
  ON admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_idx
  ON admin_audit_logs (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_logs_event_idx
  ON admin_audit_logs (event_key, created_at DESC);

CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  last_daily_free_credits_date DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signup_bonus_ip_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL UNIQUE,
  email TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_bonus_ip_claims_user_id_idx
  ON signup_bonus_ip_claims (user_id);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS admin_panel_roles (
  role_key TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_panel_role_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key TEXT NOT NULL,
  tab_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_key, tab_key)
);

CREATE TABLE IF NOT EXISTS admin_panel_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  role_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorite_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tool_id)
);

CREATE TABLE IF NOT EXISTS company_assistant_packages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_assistant_packages_user_idx
  ON company_assistant_packages (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS company_assistant_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  description TEXT NOT NULL DEFAULT '',
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  selected_theme TEXT NOT NULL DEFAULT '',
  custom_colors TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_assistant_sessions_user_idx
  ON company_assistant_sessions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS company_assistant_assets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  package_id TEXT NULL,
  session_id TEXT NULL,
  graphic_id TEXT NULL,
  url TEXT NULL,
  material_id TEXT NOT NULL DEFAULT '',
  material_title TEXT NOT NULL DEFAULT '',
  asset_type TEXT NOT NULL DEFAULT 'generated',
  prompt TEXT NOT NULL DEFAULT '',
  dimensions TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_assistant_assets_user_idx
  ON company_assistant_assets (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS company_assistant_assets_package_idx
  ON company_assistant_assets (package_id, created_at DESC);

CREATE INDEX IF NOT EXISTS company_assistant_assets_session_idx
  ON company_assistant_assets (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ad_prompt_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  input_text TEXT NOT NULL DEFAULT '',
  image_count INTEGER NOT NULL DEFAULT 0,
  prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_prompt_sessions_user_idx
  ON ad_prompt_sessions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS daily_free_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  feature TEXT NOT NULL DEFAULT '',
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, feature, usage_date)
);

CREATE TABLE IF NOT EXISTS graphics (
  id TEXT PRIMARY KEY,
  user_id TEXT NULL,
  url TEXT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'generated',
  dimensions TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  public_token TEXT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  parent_id TEXT NULL
);

CREATE INDEX IF NOT EXISTS graphics_user_id_idx ON graphics (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS graphics_public_idx ON graphics (is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS graphics_public_token_idx ON graphics (public_token);
CREATE INDEX IF NOT EXISTS graphics_parent_id_idx ON graphics (parent_id);

CREATE TABLE IF NOT EXISTS graphics_history (
  id TEXT PRIMARY KEY,
  graphic_id TEXT NULL,
  user_id TEXT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'generated',
  dimensions TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS graphics_history_created_idx ON graphics_history (created_at DESC);
CREATE INDEX IF NOT EXISTS graphics_history_user_id_idx ON graphics_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS graphics_history_type_idx ON graphics_history (type, created_at DESC);

ALTER TABLE graphics
  ADD COLUMN IF NOT EXISTS dimensions TEXT NULL;

ALTER TABLE graphics
  ADD COLUMN IF NOT EXISTS public_token TEXT NULL;

ALTER TABLE graphics
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE graphics
  ADD COLUMN IF NOT EXISTS parent_id TEXT NULL;

ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ NULL;

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS last_daily_free_credits_date DATE NULL;

ALTER TABLE credit_purchases
  ADD COLUMN IF NOT EXISTS ksef_reference_number TEXT NULL;

ALTER TABLE credit_purchases
  ADD COLUMN IF NOT EXISTS ksef_invoice_number TEXT NULL;

ALTER TABLE credit_purchases
  ADD COLUMN IF NOT EXISTS ksef_session_reference_number TEXT NULL;

ALTER TABLE credit_purchases
  ADD COLUMN IF NOT EXISTS ksef_environment TEXT NULL;

ALTER TABLE credit_purchases
  ADD COLUMN IF NOT EXISTS ksef_sent_at TIMESTAMPTZ NULL;

ALTER TABLE credit_purchases
  ADD COLUMN IF NOT EXISTS ksef_error TEXT NULL;
`;

export const hasLocalDatabase = () => Boolean(env.databaseUrl);

export const getPostgresPool = () => {
  if (!env.databaseUrl) {
    throw new Error("Missing DATABASE_URL in VPS env.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: env.databaseUrl,
      max: 10,
    });
  }

  return pool;
};

export const ensureLocalDatabaseSchema = async () => {
  if (!hasLocalDatabase()) {
    return;
  }

  schemaPromise ??= (async () => {
    const localPool = getPostgresPool();
    try {
      await localPool.query(CORE_SCHEMA_SQL);
    } catch (error) {
      schemaPromise = null;
      throw error;
    }
  })();

  await schemaPromise;
};
