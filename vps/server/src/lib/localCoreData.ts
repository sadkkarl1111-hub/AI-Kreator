import type { PoolClient } from "pg";
import { ensureLocalDatabaseSchema, getPostgresPool, hasLocalDatabase } from "./postgres.js";

export type SiteSettingRow = {
  key: string;
  value: string;
  updated_at: string | null;
};

export type SiteContentRow = {
  id: string;
  slug: string;
  title: string;
  content: string;
  updated_at: string | null;
  updated_by: string | null;
};

export type EmailTemplateRow = {
  id: string;
  slug: string;
  name: string;
  subject: string;
  html_content: string;
  variables: string[];
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type AiModelRow = {
  id: string;
  name: string;
  model_id: string;
  provider: string;
  api_model: string | null;
  credit_cost: number;
  active: boolean;
  sort_order: number;
  supports_generation: boolean;
  supports_editing: boolean;
  supports_reference_images: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ToolPricingRow = {
  id: string;
  tool_id: string;
  label: string;
  credit_cost: number;
  active: boolean;
  access_tier: string;
  visible: boolean;
  popular: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type MailerLiteConfigRow = {
  id: string;
  api_key: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type MailerLitePackageGroupRow = {
  id: string;
  package_id: string;
  group_id: string;
  group_name: string;
  created_at: string | null;
  updated_at: string | null;
};

export type CoreDataSyncResult = {
  ok: boolean;
  skipped: boolean;
  siteSettings: number;
  siteContent: number;
  emailTemplates: number;
  aiModels: number;
  toolPricing: number;
  mailerLiteConfig: number;
  mailerLiteMappings: number;
};

type PublicAiModelPurpose = "generation" | "editing" | null;

const LOCAL_TABLES = {
  siteSettings: "site_settings",
  siteContent: "site_content",
  emailTemplates: "email_templates",
  aiModels: "ai_models",
  toolPricing: "tool_pricing",
  mailerLiteConfig: "mailerlite_config",
  mailerLiteMappings: "mailerlite_package_groups",
} as const;

const mapSiteSettingRow = (row: Partial<SiteSettingRow>): SiteSettingRow => ({
  key: String(row.key || ""),
  value: String(row.value ?? ""),
  updated_at: row.updated_at ?? new Date().toISOString(),
});

const mapSiteContentRow = (row: Partial<SiteContentRow>): SiteContentRow => ({
  id: String(row.id || ""),
  slug: String(row.slug || ""),
  title: String(row.title ?? ""),
  content: String(row.content ?? ""),
  updated_at: row.updated_at ?? new Date().toISOString(),
  updated_by: row.updated_by ?? null,
});

const mapEmailTemplateRow = (row: Partial<EmailTemplateRow>): EmailTemplateRow => ({
  id: String(row.id || ""),
  slug: String(row.slug || ""),
  name: String(row.name ?? ""),
  subject: String(row.subject ?? ""),
  html_content: String(row.html_content ?? ""),
  variables: Array.isArray(row.variables) ? row.variables.map((item) => String(item)) : [],
  active: row.active ?? true,
  created_at: row.created_at ?? new Date().toISOString(),
  updated_at: row.updated_at ?? new Date().toISOString(),
});

const mapAiModelRow = (row: Partial<AiModelRow>): AiModelRow => ({
  id: String(row.id || ""),
  name: String(row.name ?? ""),
  model_id: String(row.model_id ?? ""),
  provider: String(row.provider ?? "custom"),
  api_model: row.api_model ?? (row.model_id ? String(row.model_id) : null),
  credit_cost: Number(row.credit_cost ?? 50),
  active: row.active ?? false,
  sort_order: Number(row.sort_order ?? 0),
  supports_generation: row.supports_generation ?? true,
  supports_editing: row.supports_editing ?? true,
  supports_reference_images: row.supports_reference_images ?? false,
  created_at: row.created_at ?? new Date().toISOString(),
  updated_at: row.updated_at ?? new Date().toISOString(),
});

const mapToolPricingRow = (row: Partial<ToolPricingRow>): ToolPricingRow => ({
  id: String(row.id || ""),
  tool_id: String(row.tool_id ?? ""),
  label: String(row.label ?? ""),
  credit_cost: Number(row.credit_cost ?? 50),
  active: row.active ?? true,
  access_tier: String(row.access_tier ?? "all"),
  visible: row.visible ?? true,
  popular: row.popular ?? false,
  created_at: row.created_at ?? new Date().toISOString(),
  updated_at: row.updated_at ?? new Date().toISOString(),
});

const mapMailerLiteConfigRow = (row: Partial<MailerLiteConfigRow>): MailerLiteConfigRow => ({
  id: String(row.id || ""),
  api_key: row.api_key == null ? null : String(row.api_key),
  created_at: row.created_at ?? new Date().toISOString(),
  updated_at: row.updated_at ?? new Date().toISOString(),
});

const mapMailerLitePackageGroupRow = (row: Partial<MailerLitePackageGroupRow>): MailerLitePackageGroupRow => ({
  id: String(row.id || ""),
  package_id: String(row.package_id ?? ""),
  group_id: String(row.group_id ?? ""),
  group_name: String(row.group_name ?? ""),
  created_at: row.created_at ?? new Date().toISOString(),
  updated_at: row.updated_at ?? new Date().toISOString(),
});

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
  const { rows } = await getPostgresPool().query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${tableName}`);
  return Number(rows[0]?.count || 0);
};

const fetchFallbackSiteSettings = async (): Promise<SiteSettingRow[]> => [];

const fetchFallbackSiteContent = async (): Promise<SiteContentRow[]> => [];

const fetchFallbackEmailTemplates = async (): Promise<EmailTemplateRow[]> => [];

const fetchFallbackAiModels = async (): Promise<AiModelRow[]> => [];

const fetchFallbackToolPricing = async (): Promise<ToolPricingRow[]> => [];

const fetchFallbackMailerLiteConfig = async (): Promise<MailerLiteConfigRow[]> => [];

const fetchFallbackMailerLitePackageGroups = async (): Promise<MailerLitePackageGroupRow[]> => [];

const LEGAL_TPAY_REFRESH_KEY = "legal_tpay_refresh_v2";
const OPENAI_GPT_IMAGE_2_REFRESH_KEY = "ai_model_openai_gpt_image_2_refresh_v1";
const TWO_IMAGE_MODEL_CATALOG_REFRESH_KEY = "ai_model_two_image_catalog_refresh_v1";
const FOUR_IMAGE_MODEL_CATALOG_REFRESH_KEY = "ai_model_four_image_catalog_refresh_v1";
const STUDIO_FLASH_PRICE_50_REFRESH_KEY = "ai_model_studio_flash_price_50_v1";
const STUDIO_ULTRA_GEMINI_3_PRO_STABLE_REFRESH_KEY = "ai_model_studio_ultra_gemini_3_pro_stable_v1";
const OPENAI_GPT_IMAGE_25_REFRESH_KEY = "ai_model_openai_gpt_image_25_v1";

const PUBLIC_IMAGE_MODEL_CATALOG = [
  {
    name: "Studio Economy",
    modelId: "gemini-25-image-economy",
    provider: "google",
    apiModel: "gemini-2.5-flash-image",
    creditCost: 30,
    sortOrder: 1,
  },
  {
    name: "Studio Flash",
    modelId: "gemini-25-flash-image",
    provider: "google",
    apiModel: "gemini-3.1-flash-image",
    creditCost: 50,
    sortOrder: 2,
  },
  {
    name: "Studio Pro",
    modelId: "openai-gpt-image-2",
    provider: "openai",
    apiModel: "gpt-image-2",
    creditCost: 60,
    sortOrder: 3,
  },
  {
    name: "Studio Ultra",
    modelId: "gemini-3-pro-image",
    provider: "google",
    apiModel: "gemini-3-pro-image",
    creditCost: 80,
    sortOrder: 4,
  },
] as const;

const TERMS_COMPLIANCE_ADDENDUM = `## §13. Realizacja zamówienia i kontakt reklamacyjny
Pakiety kredytów są produktami cyfrowymi i są aktywowane automatycznie po potwierdzeniu płatności online.
- maksymalny czas realizacji zamówienia wynosi 1 dzień roboczy od chwili potwierdzenia płatności
- w większości przypadków kredyty są dodawane do konta w ciągu kilku minut
- reklamacje dotyczące płatności, aktywacji pakietu lub działania produktu można składać mailowo na adres: sadkkarl1111@gmail.com albo listownie na adres: SnappyWeb Karol Sadowski, Główna 6, 56-100 Mojęcice
- reklamacje są rozpatrywane w terminie 14 dni roboczych od dnia ich otrzymania`;

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

const replacePaymentProviderMentions = (content: string) => {
  let nextContent = String(content || "");

  nextContent = nextContent.replace(
    /- PayU S\.A\. [–-] obsługa płatności online\. Polityka prywatności: https:\/\/poland\.payu\.com\/prywatnosc\//g,
    "- Tpay (Krajowy Integrator Płatności S.A.) - obsługa płatności online i autoryzacji transakcji. Polityka prywatności: https://tpay.com/polityka-prywatnosci"
  );

  nextContent = nextContent.replace(
    /- zewnętrzny operator płatności online wskazany w formularzu zakupu [–-] obsługa płatności online i autoryzacji transakcji/g,
    "- Tpay (Krajowy Integrator Płatności S.A.) - obsługa płatności online i autoryzacji transakcji. Polityka prywatności: https://tpay.com/polityka-prywatnosci"
  );

  nextContent = nextContent.replace(
    /- płatności online są realizowane przez PayU S\.A\., a użytkownik jest przekierowywany do bezpiecznego środowiska płatności operatora/g,
    "- płatności online są realizowane przez Tpay (Krajowy Integrator Płatności S.A.), a użytkownik jest przekierowywany do bezpiecznego środowiska płatności operatora"
  );

  nextContent = nextContent.replace(
    /- płatności online są realizowane przez zewnętrznego operatora płatności, a użytkownik jest przekierowywany do bezpiecznego środowiska płatności tego operatora/g,
    "- płatności online są realizowane przez Tpay (Krajowy Integrator Płatności S.A.), a użytkownik jest przekierowywany do bezpiecznego środowiska płatności operatora"
  );

  nextContent = nextContent.replace(
    /w tym PayU, Cloudflare, Google reCAPTCHA, CookieYes, Resend, MailerLite i KSeF/g,
    "w tym Tpay, Cloudflare, Google reCAPTCHA, CookieYes, Resend, MailerLite i KSeF"
  );

  nextContent = nextContent.replace(
    /w tym operatorze płatności, Cloudflare, Google reCAPTCHA, CookieYes, Resend, MailerLite i KSeF/g,
    "w tym Tpay, Cloudflare, Google reCAPTCHA, CookieYes, Resend, MailerLite i KSeF"
  );

  nextContent = nextContent.replace(/PayU S\.A\./g, "Tpay (Krajowy Integrator Płatności S.A.)");
  nextContent = nextContent.replace(/\bPayU\b/g, "Tpay");
  nextContent = nextContent.replace(/Ostatnia aktualizacja: \d{1,2} kwietnia 2026 r\./g, "Ostatnia aktualizacja: 21 kwietnia 2026 r.");
  nextContent = nextContent.replace(/- ostatnia aktualizacja: \d{1,2} kwietnia 2026 r\./g, "- ostatnia aktualizacja: 21 kwietnia 2026 r.");

  return nextContent;
};

const ensureTermsComplianceContent = (content: string) => {
  const normalized = String(content || "").trim();
  if (!normalized) return TERMS_COMPLIANCE_ADDENDUM;

  if (/maksymalny czas realizacji zam[oó]wienia wynosi 1 dzie[nń] roboczy/i.test(normalized)) {
    return normalized;
  }

  return `${normalized}\n\n${TERMS_COMPLIANCE_ADDENDUM}`;
};

const replaceLocalSiteSettings = async (rows: SiteSettingRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM site_settings");
      for (const row of rows) {
        await client.query(
          "INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, $3)",
          [row.key, row.value, row.updated_at]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalSiteContent = async (rows: SiteContentRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM site_content");
      for (const row of rows) {
        await client.query(
          "INSERT INTO site_content (id, slug, title, content, updated_at, updated_by) VALUES ($1, $2, $3, $4, $5, $6)",
          [row.id, row.slug, row.title, row.content, row.updated_at, row.updated_by]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalEmailTemplates = async (rows: EmailTemplateRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM email_templates");
      for (const row of rows) {
        await client.query(
          [
            "INSERT INTO email_templates",
            "(id, slug, name, subject, html_content, variables, active, created_at, updated_at)",
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          ].join(" "),
          [row.id, row.slug, row.name, row.subject, row.html_content, row.variables, row.active, row.created_at, row.updated_at]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalAiModels = async (rows: AiModelRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM ai_models");
      for (const row of rows) {
        await client.query(
          [
            "INSERT INTO ai_models",
            "(id, name, model_id, provider, api_model, credit_cost, active, sort_order,",
            "supports_generation, supports_editing, supports_reference_images, created_at, updated_at)",
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
          ].join(" "),
          [
            row.id,
            row.name,
            row.model_id,
            row.provider,
            row.api_model,
            row.credit_cost,
            row.active,
            row.sort_order,
            row.supports_generation,
            row.supports_editing,
            row.supports_reference_images,
            row.created_at,
            row.updated_at,
          ]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalToolPricing = async (rows: ToolPricingRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM tool_pricing");
      for (const row of rows) {
        await client.query(
          [
            "INSERT INTO tool_pricing",
            "(id, tool_id, label, credit_cost, active, access_tier, visible, popular, created_at, updated_at)",
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
          ].join(" "),
          [
            row.id,
            row.tool_id,
            row.label,
            row.credit_cost,
            row.active,
            row.access_tier,
            row.visible,
            row.popular,
            row.created_at,
            row.updated_at,
          ]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalMailerLiteConfig = async (rows: MailerLiteConfigRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM mailerlite_config");
      for (const row of rows) {
        await client.query(
          "INSERT INTO mailerlite_config (id, api_key, created_at, updated_at) VALUES ($1, $2, $3, $4)",
          [row.id, row.api_key, row.created_at, row.updated_at]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

const replaceLocalMailerLitePackageGroups = async (rows: MailerLitePackageGroupRow[]) => {
  if (!hasLocalDatabase()) return;

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM mailerlite_package_groups");
      for (const row of rows) {
        await client.query(
          [
            "INSERT INTO mailerlite_package_groups",
            "(id, package_id, group_id, group_name, created_at, updated_at)",
            "VALUES ($1, $2, $3, $4, $5, $6)",
          ].join(" "),
          [row.id, row.package_id, row.group_id, row.group_name, row.created_at, row.updated_at]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
};

export const syncLocalCoreData = async ({
  onlyIfEmpty = false,
}: {
  onlyIfEmpty?: boolean;
} = {}): Promise<CoreDataSyncResult> => {
  void onlyIfEmpty;
  if (hasLocalDatabase()) {
    await ensureLocalDatabaseSchema();
  }

  return {
    ok: true,
    skipped: true,
    siteSettings: 0,
    siteContent: 0,
    emailTemplates: 0,
    aiModels: 0,
    toolPricing: 0,
    mailerLiteConfig: 0,
    mailerLiteMappings: 0,
  };
};

export const getLocalSettingsMap = async (keys: string[]) => {
  if (!keys.length) return {} as Record<string, string>;

  if (!hasLocalDatabase()) {
    const rows = await fetchFallbackSiteSettings();
    const allowed = new Set(keys);
    return Object.fromEntries(rows.filter((row) => allowed.has(row.key)).map((row) => [row.key, row.value]));
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<SiteSettingRow>(
    "SELECT key, value, updated_at FROM site_settings WHERE key = ANY($1::text[])",
    [keys]
  );

  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
};

export const listLocalSiteSettings = async () => {
  if (!hasLocalDatabase()) {
    return fetchFallbackSiteSettings();
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<SiteSettingRow>(
    "SELECT key, value, updated_at FROM site_settings ORDER BY key ASC"
  );
  return rows;
};

export const upsertLocalSiteSettingsRows = async (rows: Array<Partial<SiteSettingRow>>) => {
  if (!hasLocalDatabase()) return [];

  await withLocalClient(async (client) => {
    for (const row of rows.map(mapSiteSettingRow)) {
      await client.query(
        [
          "INSERT INTO site_settings (key, value, updated_at)",
          "VALUES ($1, $2, $3)",
          "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at",
        ].join(" "),
        [row.key, row.value, row.updated_at]
      );
    }
  });

  const keys = rows.map((row) => String(row.key || "")).filter(Boolean);
  if (!keys.length) return [];

  await ensureLocalDatabaseSchema();
  const result = await getPostgresPool().query<SiteSettingRow>(
    "SELECT key, value, updated_at FROM site_settings WHERE key = ANY($1::text[]) ORDER BY key ASC",
    [keys]
  );
  return result.rows;
};

export const listLocalSiteContent = async () => {
  if (!hasLocalDatabase()) {
    return fetchFallbackSiteContent();
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<SiteContentRow>(
    "SELECT id, slug, title, content, updated_at, updated_by FROM site_content ORDER BY slug ASC"
  );
  return rows;
};

export const getLocalSiteContentBySlug = async (slug: string) => {
  if (!hasLocalDatabase()) {
    const rows = await fetchFallbackSiteContent();
    return rows.find((row) => row.slug === slug) ?? null;
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<SiteContentRow>(
    "SELECT id, slug, title, content, updated_at, updated_by FROM site_content WHERE slug = $1 LIMIT 1",
    [slug]
  );
  return rows[0] ?? null;
};

export const refreshLocalLegalContentForTpay = async () => {
  if (!hasLocalDatabase()) return { ok: true, skipped: true, updated: 0 };

  await ensureLocalDatabaseSchema();
  const alreadyApplied = await getMigrationState(LEGAL_TPAY_REFRESH_KEY);
  if (alreadyApplied === "done") {
    return { ok: true, skipped: true, updated: 0 };
  }

  const rows = await listLocalSiteContent();
  const legalRows = rows.filter((row) => row.slug === "terms" || row.slug === "privacy");

  if (!legalRows.length) {
    await setMigrationState(LEGAL_TPAY_REFRESH_KEY, "done");
    return { ok: true, skipped: true, updated: 0 };
  }

  const updates: Partial<SiteContentRow>[] = [];
  for (const row of legalRows) {
    const nextContent =
      row.slug === "terms"
        ? ensureTermsComplianceContent(replacePaymentProviderMentions(row.content))
        : replacePaymentProviderMentions(row.content);

    if (nextContent === row.content) continue;

    updates.push({
      ...row,
      content: nextContent,
      updated_at: new Date().toISOString(),
    });
  }

  if (!updates.length) {
    await setMigrationState(LEGAL_TPAY_REFRESH_KEY, "done");
    return { ok: true, skipped: true, updated: 0 };
  }

  await upsertLocalSiteContentRows(updates);
  await setMigrationState(LEGAL_TPAY_REFRESH_KEY, "done");

  return { ok: true, skipped: false, updated: updates.length };
};

export const refreshLocalAiModelCatalog = async () => {
  if (!hasLocalDatabase()) return { ok: true, skipped: true, updated: 0 };

  await ensureLocalDatabaseSchema();
  let skipped = true;
  let updated = 0;

  const openAiRefreshApplied = await getMigrationState(OPENAI_GPT_IMAGE_2_REFRESH_KEY);
  if (openAiRefreshApplied !== "done") {
    const result = await getPostgresPool().query(
      [
        "UPDATE ai_models",
        "SET api_model = $1, updated_at = now()",
        "WHERE model_id = $2 AND api_model IS DISTINCT FROM $1",
      ].join(" "),
      ["gpt-image-2", "openai-gpt-image-2"]
    );

    await setMigrationState(OPENAI_GPT_IMAGE_2_REFRESH_KEY, "done");
    updated += result.rowCount ?? 0;
    skipped = false;
  }

  const fourModelCatalogApplied = await getMigrationState(FOUR_IMAGE_MODEL_CATALOG_REFRESH_KEY);
  if (fourModelCatalogApplied !== "done") {
    const activeModelIds = PUBLIC_IMAGE_MODEL_CATALOG.map((model) => model.modelId);

    await withLocalClient(async (client) => {
      await client.query("BEGIN");
      try {
        const disabledResult = await client.query(
          [
            "UPDATE ai_models",
            "SET active = false, updated_at = now()",
            "WHERE model_id <> ALL($1::text[]) AND active = true",
          ].join(" "),
          [activeModelIds]
        );
        updated += disabledResult.rowCount ?? 0;

        for (const model of PUBLIC_IMAGE_MODEL_CATALOG) {
          const upsertResult = await client.query(
            [
              "INSERT INTO ai_models",
              "(name, model_id, provider, api_model, credit_cost, active, sort_order,",
              "supports_generation, supports_editing, supports_reference_images, updated_at)",
              "VALUES ($1, $2, $3, $4, $5, true, $6, true, true, true, now())",
              "ON CONFLICT (model_id) DO UPDATE SET",
              "name = EXCLUDED.name, provider = EXCLUDED.provider, api_model = EXCLUDED.api_model,",
              "credit_cost = EXCLUDED.credit_cost, active = EXCLUDED.active, sort_order = EXCLUDED.sort_order,",
              "supports_generation = EXCLUDED.supports_generation, supports_editing = EXCLUDED.supports_editing,",
              "supports_reference_images = EXCLUDED.supports_reference_images, updated_at = EXCLUDED.updated_at",
            ].join(" "),
            [model.name, model.modelId, model.provider, model.apiModel, model.creditCost, model.sortOrder]
          );
          updated += upsertResult.rowCount ?? 0;
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });

    await setMigrationState(TWO_IMAGE_MODEL_CATALOG_REFRESH_KEY, "done");
    await setMigrationState(FOUR_IMAGE_MODEL_CATALOG_REFRESH_KEY, "done");
    skipped = false;
  }

  const studioFlashPriceApplied = await getMigrationState(STUDIO_FLASH_PRICE_50_REFRESH_KEY);
  if (studioFlashPriceApplied !== "done") {
    const result = await getPostgresPool().query(
      [
        "UPDATE ai_models",
        "SET credit_cost = $1, updated_at = now()",
        "WHERE model_id = $2 AND credit_cost IS DISTINCT FROM $1",
      ].join(" "),
      [50, "gemini-25-flash-image"],
    );

    await setMigrationState(STUDIO_FLASH_PRICE_50_REFRESH_KEY, "done");
    updated += result.rowCount ?? 0;
    skipped = false;
  }

  const studioUltraStableApplied = await getMigrationState(STUDIO_ULTRA_GEMINI_3_PRO_STABLE_REFRESH_KEY);
  if (studioUltraStableApplied !== "done") {
    const result = await getPostgresPool().query(
      [
        "UPDATE ai_models",
        "SET provider = $1, api_model = $2, supports_reference_images = true, updated_at = now()",
        "WHERE model_id = $3 AND (provider IS DISTINCT FROM $1 OR api_model IS DISTINCT FROM $2 OR supports_reference_images IS DISTINCT FROM true)",
      ].join(" "),
      ["google", "gemini-3-pro-image", "gemini-3-pro-image"],
    );

    await setMigrationState(STUDIO_ULTRA_GEMINI_3_PRO_STABLE_REFRESH_KEY, "done");
    updated += result.rowCount ?? 0;
    skipped = false;
  }

  const image25Applied = await getMigrationState(OPENAI_GPT_IMAGE_25_REFRESH_KEY);
  if (image25Applied !== "done") {
    await withLocalClient(async (client) => {
      await client.query("BEGIN");
      try {
        for (const [index, variant] of ["flare", "sunburst"].entries()) {
          const result = await client.query(
            [
              "INSERT INTO ai_models",
              "(name, model_id, provider, api_model, credit_cost, active, sort_order,",
              "supports_generation, supports_editing, supports_reference_images, updated_at)",
              "VALUES ($1, $2, 'openai', $3, 60, true, $4, true, true, true, now())",
              "ON CONFLICT (model_id) DO NOTHING",
            ].join(" "),
            [variant === "flare" ? "Flare" : "Sunburst", `openai-gpt-image-2.5-${variant}`, `gpt-image-2.5-${variant}`, 5 + index],
          );
          updated += result.rowCount ?? 0;
        }
        await client.query(
          "INSERT INTO migration_state (key, value, updated_at) VALUES ($1, 'done', now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at",
          [OPENAI_GPT_IMAGE_25_REFRESH_KEY],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
    skipped = false;
  }

  return { ok: true, skipped, updated };
};

export const upsertLocalSiteContentRows = async (rows: Array<Partial<SiteContentRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapSiteContentRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO site_content (id, slug, title, content, updated_at, updated_by)",
          "VALUES ($1, $2, $3, $4, $5, $6)",
          "ON CONFLICT (slug) DO UPDATE SET",
          "id = EXCLUDED.id, title = EXCLUDED.title, content = EXCLUDED.content,",
          "updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by",
        ].join(" "),
        [row.id, row.slug, row.title, row.content, row.updated_at, row.updated_by]
      );
    }
  });

  const slugs = normalizedRows.map((row) => row.slug);
  const { rows: resultRows } = await getPostgresPool().query<SiteContentRow>(
    "SELECT id, slug, title, content, updated_at, updated_by FROM site_content WHERE slug = ANY($1::text[]) ORDER BY slug ASC",
    [slugs]
  );
  return resultRows;
};

export const listLocalEmailTemplates = async () => {
  if (!hasLocalDatabase()) {
    return fetchFallbackEmailTemplates();
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<EmailTemplateRow>(
    "SELECT id, slug, name, subject, html_content, variables, active, created_at, updated_at FROM email_templates ORDER BY created_at ASC"
  );
  return rows;
};

export const getLocalEmailTemplateBySlug = async (slug: string, onlyActive = false) => {
  if (!hasLocalDatabase()) {
    const rows = await fetchFallbackEmailTemplates();
    return rows.find((row) => row.slug === slug && (!onlyActive || row.active)) ?? null;
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<EmailTemplateRow>(
    [
      "SELECT id, slug, name, subject, html_content, variables, active, created_at, updated_at",
      "FROM email_templates",
      "WHERE slug = $1",
      onlyActive ? "AND active = true" : "",
      "LIMIT 1",
    ]
      .filter(Boolean)
      .join(" "),
    [slug]
  );

  return rows[0] ?? null;
};

export const upsertLocalEmailTemplateRows = async (rows: Array<Partial<EmailTemplateRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapEmailTemplateRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO email_templates",
          "(id, slug, name, subject, html_content, variables, active, created_at, updated_at)",
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          "ON CONFLICT (slug) DO UPDATE SET",
          "id = EXCLUDED.id, name = EXCLUDED.name, subject = EXCLUDED.subject,",
          "html_content = EXCLUDED.html_content, variables = EXCLUDED.variables,",
          "active = EXCLUDED.active, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at",
        ].join(" "),
        [row.id, row.slug, row.name, row.subject, row.html_content, row.variables, row.active, row.created_at, row.updated_at]
      );
    }
  });

  const slugs = normalizedRows.map((row) => row.slug);
  const { rows: resultRows } = await getPostgresPool().query<EmailTemplateRow>(
    [
      "SELECT id, slug, name, subject, html_content, variables, active, created_at, updated_at",
      "FROM email_templates WHERE slug = ANY($1::text[]) ORDER BY created_at ASC",
    ].join(" "),
    [slugs]
  );
  return resultRows;
};

export const deleteLocalEmailTemplate = async (id: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM email_templates WHERE id = $1", [id]);
};

export const listLocalAiModels = async () => {
  if (!hasLocalDatabase()) {
    return fetchFallbackAiModels();
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<AiModelRow>(
    [
      "SELECT id, name, model_id, provider, api_model, credit_cost, active, sort_order,",
      "supports_generation, supports_editing, supports_reference_images, created_at, updated_at",
      "FROM ai_models ORDER BY sort_order ASC, created_at ASC",
    ].join(" ")
  );
  return rows;
};

export const listLocalPublicAiModels = async (purpose: PublicAiModelPurpose) => {
  if (!hasLocalDatabase()) {
    const rows = await fetchFallbackAiModels();
    return rows.filter((row) => {
      if (!row.active) return false;
      if (purpose === "generation") return row.supports_generation;
      if (purpose === "editing") return row.supports_editing;
      return true;
    });
  }

  await ensureLocalDatabaseSchema();
  const filters = ["active = true"];
  if (purpose === "generation") filters.push("supports_generation = true");
  if (purpose === "editing") filters.push("supports_editing = true");

  const { rows } = await getPostgresPool().query<AiModelRow>(
    [
      "SELECT id, name, model_id, provider, api_model, credit_cost, active, sort_order,",
      "supports_generation, supports_editing, supports_reference_images, created_at, updated_at",
      "FROM ai_models",
      `WHERE ${filters.join(" AND ")}`,
      "ORDER BY sort_order ASC, created_at ASC",
    ].join(" ")
  );

  return rows;
};

export const upsertLocalAiModelRows = async (rows: Array<Partial<AiModelRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapAiModelRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO ai_models",
          "(id, name, model_id, provider, api_model, credit_cost, active, sort_order,",
          "supports_generation, supports_editing, supports_reference_images, created_at, updated_at)",
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
          "ON CONFLICT (model_id) DO UPDATE SET",
          "id = EXCLUDED.id, name = EXCLUDED.name, provider = EXCLUDED.provider, api_model = EXCLUDED.api_model,",
          "credit_cost = EXCLUDED.credit_cost, active = EXCLUDED.active, sort_order = EXCLUDED.sort_order,",
          "supports_generation = EXCLUDED.supports_generation, supports_editing = EXCLUDED.supports_editing,",
          "supports_reference_images = EXCLUDED.supports_reference_images, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at",
        ].join(" "),
        [
          row.id,
          row.name,
          row.model_id,
          row.provider,
          row.api_model,
          row.credit_cost,
          row.active,
          row.sort_order,
          row.supports_generation,
          row.supports_editing,
          row.supports_reference_images,
          row.created_at,
          row.updated_at,
        ]
      );
    }
  });

  const modelIds = normalizedRows.map((row) => row.model_id);
  const { rows: resultRows } = await getPostgresPool().query<AiModelRow>(
    [
      "SELECT id, name, model_id, provider, api_model, credit_cost, active, sort_order,",
      "supports_generation, supports_editing, supports_reference_images, created_at, updated_at",
      "FROM ai_models WHERE model_id = ANY($1::text[]) ORDER BY sort_order ASC, created_at ASC",
    ].join(" "),
    [modelIds]
  );
  return resultRows;
};

export const deleteLocalAiModel = async (id: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM ai_models WHERE id = $1", [id]);
};

export const listLocalToolPricing = async () => {
  if (!hasLocalDatabase()) {
    return fetchFallbackToolPricing();
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<ToolPricingRow>(
    [
      "SELECT id, tool_id, label, credit_cost, active, access_tier, visible, popular, created_at, updated_at",
      "FROM tool_pricing ORDER BY label ASC",
    ].join(" ")
  );
  return rows;
};

export const listLocalPublicToolPricing = async () => {
  const rows = await listLocalToolPricing();
  return rows.map((row) => ({
    tool_id: row.tool_id,
    credit_cost: row.credit_cost,
    active: row.active,
    visible: row.visible,
  }));
};

export const upsertLocalToolPricingRows = async (rows: Array<Partial<ToolPricingRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapToolPricingRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO tool_pricing",
          "(id, tool_id, label, credit_cost, active, access_tier, visible, popular, created_at, updated_at)",
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
          "ON CONFLICT (tool_id) DO UPDATE SET",
          "id = EXCLUDED.id, label = EXCLUDED.label, credit_cost = EXCLUDED.credit_cost,",
          "active = EXCLUDED.active, access_tier = EXCLUDED.access_tier, visible = EXCLUDED.visible,",
          "popular = EXCLUDED.popular, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at",
        ].join(" "),
        [
          row.id,
          row.tool_id,
          row.label,
          row.credit_cost,
          row.active,
          row.access_tier,
          row.visible,
          row.popular,
          row.created_at,
          row.updated_at,
        ]
      );
    }
  });

  const toolIds = normalizedRows.map((row) => row.tool_id);
  const { rows: resultRows } = await getPostgresPool().query<ToolPricingRow>(
    [
      "SELECT id, tool_id, label, credit_cost, active, access_tier, visible, popular, created_at, updated_at",
      "FROM tool_pricing WHERE tool_id = ANY($1::text[]) ORDER BY label ASC",
    ].join(" "),
    [toolIds]
  );
  return resultRows;
};

export const getLocalMailerLiteConfig = async () => {
  if (!hasLocalDatabase()) {
    const rows = await fetchFallbackMailerLiteConfig();
    return rows[0] ?? null;
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<MailerLiteConfigRow>(
    "SELECT id, api_key, created_at, updated_at FROM mailerlite_config ORDER BY created_at ASC LIMIT 1"
  );
  return rows[0] ?? null;
};

export const upsertLocalMailerLiteConfig = async (apiKey: string) => {
  if (!hasLocalDatabase()) return null;

  const normalizedApiKey = apiKey.trim();
  if (!normalizedApiKey) return null;

  await withLocalClient(async (client) => {
    const existing = await client.query<MailerLiteConfigRow>(
      "SELECT id, api_key, created_at, updated_at FROM mailerlite_config ORDER BY created_at ASC LIMIT 1"
    );

    if (existing.rows[0]) {
      await client.query(
        "UPDATE mailerlite_config SET api_key = $2, updated_at = now() WHERE id = $1",
        [existing.rows[0].id, normalizedApiKey]
      );
      await client.query("DELETE FROM mailerlite_config WHERE id <> $1", [existing.rows[0].id]);
      return;
    }

    await client.query("INSERT INTO mailerlite_config (api_key) VALUES ($1)", [normalizedApiKey]);
  });

  return getLocalMailerLiteConfig();
};

export const listLocalMailerLitePackageGroups = async () => {
  if (!hasLocalDatabase()) {
    return fetchFallbackMailerLitePackageGroups();
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<MailerLitePackageGroupRow>(
    [
      "SELECT id, package_id, group_id, group_name, created_at, updated_at",
      "FROM mailerlite_package_groups ORDER BY package_id ASC",
    ].join(" ")
  );
  return rows;
};

export const getLocalMailerLitePackageGroupByPackageId = async (packageId: string) => {
  if (!hasLocalDatabase()) {
    const rows = await fetchFallbackMailerLitePackageGroups();
    return rows.find((row) => row.package_id === packageId) ?? null;
  }

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<MailerLitePackageGroupRow>(
    [
      "SELECT id, package_id, group_id, group_name, created_at, updated_at",
      "FROM mailerlite_package_groups WHERE package_id = $1 LIMIT 1",
    ].join(" "),
    [packageId]
  );
  return rows[0] ?? null;
};

export const replaceLocalMailerLitePackageGroupRows = async (rows: Array<Partial<MailerLitePackageGroupRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows
    .map(mapMailerLitePackageGroupRow)
    .filter((row) => row.package_id.trim() && row.group_id.trim())
    .map((row) => ({
      ...row,
      package_id: row.package_id.trim(),
      group_id: row.group_id.trim(),
      group_name: row.group_name.trim(),
    }));

  await withLocalClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM mailerlite_package_groups");
      for (const row of normalizedRows) {
        await client.query(
          [
            "INSERT INTO mailerlite_package_groups",
            "(package_id, group_id, group_name, created_at, updated_at)",
            "VALUES ($1, $2, $3, $4, $5)",
          ].join(" "),
          [row.package_id, row.group_id, row.group_name, row.created_at, row.updated_at]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  return listLocalMailerLitePackageGroups();
};
