import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { ensureLocalDatabaseSchema, getPostgresPool, hasLocalDatabase } from "./postgres.js";

export type CreditPackageRow = {
  id: string;
  label: string;
  credits: number;
  price_grosze: number;
  popular: boolean;
  active: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
};

export type CreditPurchaseRow = {
  id: string;
  user_id: string;
  amount: number;
  paid_amount: number | null;
  credits: number;
  status: string;
  payment_provider: string | null;
  payment_session_id: string | null;
  payment_order_id: string | null;
  stripe_session_id: string | null;
  payu_order_id: string | null;
  billing_type: string | null;
  billing_name: string | null;
  billing_nip: string | null;
  billing_company: string | null;
  billing_address: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
  ksef_reference_number: string | null;
  ksef_invoice_number: string | null;
  ksef_session_reference_number: string | null;
  ksef_environment: string | null;
  ksef_sent_at: string | null;
  ksef_error: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CreditUsageRow = {
  id: string;
  user_id: string;
  credits_used: number;
  model: string;
  created_at: string | null;
};

export type InvoiceSettingsRow = {
  id: string;
  company_name: string;
  nip: string;
  address: string;
  postal_code: string;
  city: string;
  email: string;
  created_at: string | null;
  updated_at: string | null;
};

export type BillingDataSyncResult = {
  ok: boolean;
  skipped: boolean;
  creditPackages: number;
  creditPurchases: number;
  creditUsage: number;
  invoiceSettings: number;
};

export type CreditPurchaseListOptions = {
  userId?: string;
  status?: string | string[];
  limit?: number;
  latestFirst?: boolean;
};

export type CreditUsageListOptions = {
  userId?: string;
  since?: string;
  limit?: number;
  latestFirst?: boolean;
};

type CompleteCreditPurchaseResult = {
  applied: boolean;
  purchase: CreditPurchaseRow | null;
  balance: number | null;
};

const LOCAL_TABLES = {
  creditPackages: "credit_packages",
  creditPurchases: "credit_purchases",
  creditUsage: "credit_usage",
  invoiceSettings: "invoice_settings",
} as const;

const CREDIT_PACKAGES_SELECT =
  "id, label, credits, price_grosze, popular, active, sort_order, created_at, updated_at";
const CREDIT_PURCHASES_SELECT = [
  "id",
  "user_id",
  "amount",
  "paid_amount",
  "credits",
  "status",
  "payment_provider",
  "payment_session_id",
  "payment_order_id",
  "stripe_session_id",
  "payu_order_id",
  "billing_type",
  "billing_name",
  "billing_nip",
  "billing_company",
  "billing_address",
  "billing_postal_code",
  "billing_city",
  "ksef_reference_number",
  "ksef_invoice_number",
  "ksef_session_reference_number",
  "ksef_environment",
  "ksef_sent_at",
  "ksef_error",
  "created_at",
  "updated_at",
].join(", ");
const CREDIT_USAGE_SELECT = "id, user_id, credits_used, model, created_at";
const INVOICE_SETTINGS_SELECT =
  "id, company_name, nip, address, postal_code, city, email, created_at, updated_at";
const BILLING_SEEDED_KEY = "billing_seeded_v1";
const DEFAULT_CREDIT_PACKAGES: Array<Partial<CreditPackageRow>> = [
  {
    id: "pack_25",
    label: "Starter",
    credits: 1250,
    price_grosze: 2500,
    popular: false,
    active: true,
    sort_order: 1,
  },
  {
    id: "pack_49",
    label: "Popular",
    credits: 2750,
    price_grosze: 4900,
    popular: true,
    active: true,
    sort_order: 2,
  },
  {
    id: "pack_99",
    label: "Pro",
    credits: 6000,
    price_grosze: 9900,
    popular: false,
    active: true,
    sort_order: 3,
  },
  {
    id: "pack_199",
    label: "Enterprise",
    credits: 15000,
    price_grosze: 19900,
    popular: false,
    active: true,
    sort_order: 4,
  },
];

let fullSyncPromise: Promise<BillingDataSyncResult> | null = null;

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

const mapCreditPackageRow = (row: Partial<CreditPackageRow>): CreditPackageRow => ({
  id: String(row.id || randomUUID()),
  label: String(row.label ?? ""),
  credits: Number(row.credits ?? 0),
  price_grosze: Number(row.price_grosze ?? 0),
  popular: row.popular ?? false,
  active: row.active ?? true,
  sort_order: Number(row.sort_order ?? 0),
  created_at: row.created_at ?? new Date().toISOString(),
  updated_at: row.updated_at ?? new Date().toISOString(),
});

const mapCreditPurchaseRow = (row: Partial<CreditPurchaseRow>): CreditPurchaseRow => ({
  id: String(row.id || randomUUID()),
  user_id: String(row.user_id || ""),
  amount: Number(row.amount ?? 0),
  paid_amount: row.paid_amount != null ? Number(row.paid_amount) : null,
  credits: Number(row.credits ?? 0),
  status: String(row.status ?? "pending"),
  payment_provider: row.payment_provider ?? (row.payment_order_id || row.payu_order_id || row.payment_session_id || row.stripe_session_id ? "payu" : null),
  payment_session_id: row.payment_session_id ?? row.stripe_session_id ?? null,
  payment_order_id: row.payment_order_id ?? row.payu_order_id ?? null,
  stripe_session_id: row.stripe_session_id ?? null,
  payu_order_id: row.payu_order_id ?? null,
  billing_type: row.billing_type ?? null,
  billing_name: row.billing_name ?? null,
  billing_nip: row.billing_nip ?? null,
  billing_company: row.billing_company ?? null,
  billing_address: row.billing_address ?? null,
  billing_postal_code: row.billing_postal_code ?? null,
  billing_city: row.billing_city ?? null,
  ksef_reference_number: row.ksef_reference_number ?? null,
  ksef_invoice_number: row.ksef_invoice_number ?? null,
  ksef_session_reference_number: row.ksef_session_reference_number ?? null,
  ksef_environment: row.ksef_environment ?? null,
  ksef_sent_at: row.ksef_sent_at ?? null,
  ksef_error: row.ksef_error ?? null,
  created_at: row.created_at ?? new Date().toISOString(),
  updated_at: row.updated_at ?? new Date().toISOString(),
});

const mapCreditUsageRow = (row: Partial<CreditUsageRow>): CreditUsageRow => ({
  id: String(row.id || randomUUID()),
  user_id: String(row.user_id || ""),
  credits_used: Number(row.credits_used ?? 0),
  model: String(row.model ?? ""),
  created_at: row.created_at ?? new Date().toISOString(),
});

const mapInvoiceSettingsRow = (row: Partial<InvoiceSettingsRow>): InvoiceSettingsRow => ({
  id: String(row.id || randomUUID()),
  company_name: String(row.company_name ?? "Kreator AI"),
  nip: String(row.nip ?? ""),
  address: String(row.address ?? ""),
  postal_code: String(row.postal_code ?? ""),
  city: String(row.city ?? ""),
  email: String(row.email ?? ""),
  created_at: row.created_at ?? new Date().toISOString(),
  updated_at: row.updated_at ?? new Date().toISOString(),
});

const fetchFallbackCreditPackages = async (_activeOnly = false): Promise<CreditPackageRow[]> => [];

const fetchFallbackCreditPackageById = async (_id: string): Promise<CreditPackageRow | null> => null;

const fetchFallbackCreditPurchases = async (_options: CreditPurchaseListOptions = {}): Promise<CreditPurchaseRow[]> =>
  [];

const fetchFallbackCreditPurchaseById = async (_id: string): Promise<CreditPurchaseRow | null> => null;

const fetchFallbackCreditPurchaseByStripeSessionId = async (
  _sessionId: string
): Promise<CreditPurchaseRow | null> => null;

const fetchFallbackCreditPurchaseByPayuOrderId = async (
  _orderId: string
): Promise<CreditPurchaseRow | null> => null;

const fetchFallbackAllCreditPurchases = async (): Promise<CreditPurchaseRow[]> => [];

const fetchFallbackCreditUsage = async (_options: CreditUsageListOptions = {}): Promise<CreditUsageRow[]> => [];

const fetchFallbackAllCreditUsage = async (): Promise<CreditUsageRow[]> => [];

const fetchFallbackInvoiceSettings = async (): Promise<InvoiceSettingsRow | null> => null;

const ensureDefaultLocalCreditPackages = async () => {
  if (!hasLocalDatabase()) return;

  await ensureLocalDatabaseSchema();
  const packagesCount = await countLocalRows(LOCAL_TABLES.creditPackages);
  if (packagesCount > 0) return;

  await upsertLocalCreditPackageRows(DEFAULT_CREDIT_PACKAGES);
};

const ensureLocalBillingSeeded = async () => {
  if (!hasLocalDatabase()) return;

  await ensureLocalDatabaseSchema();
  await ensureDefaultLocalCreditPackages();

  const seeded = await getMigrationState(BILLING_SEEDED_KEY);
  if (seeded === "done") return;

  fullSyncPromise ??= syncLocalBillingData({ onlyIfEmpty: true })
    .then(async (result) => {
      await ensureDefaultLocalCreditPackages();
      await setMigrationState(BILLING_SEEDED_KEY, "done");
      return result;
    })
    .finally(() => {
      fullSyncPromise = null;
    });

  await fullSyncPromise;
};

export const syncLocalBillingData = async ({ onlyIfEmpty = false }: { onlyIfEmpty?: boolean } = {}) => {
  void onlyIfEmpty;
  if (hasLocalDatabase()) {
    await ensureLocalDatabaseSchema();
  }

  return {
    ok: true,
    skipped: true,
    creditPackages: 0,
    creditPurchases: 0,
    creditUsage: 0,
    invoiceSettings: 0,
  } satisfies BillingDataSyncResult;
};

export const upsertLocalCreditPackageRows = async (rows: Array<Partial<CreditPackageRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapCreditPackageRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO credit_packages",
          "(id, label, credits, price_grosze, popular, active, sort_order, created_at, updated_at)",
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          "ON CONFLICT (id) DO UPDATE SET",
          "label = EXCLUDED.label, credits = EXCLUDED.credits, price_grosze = EXCLUDED.price_grosze,",
          "popular = EXCLUDED.popular, active = EXCLUDED.active, sort_order = EXCLUDED.sort_order,",
          "created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at",
        ].join(" "),
        [
          row.id,
          row.label,
          row.credits,
          row.price_grosze,
          row.popular,
          row.active,
          row.sort_order,
          row.created_at,
          row.updated_at,
        ]
      );
    }
  });

  const ids = normalizedRows.map((row) => row.id);
  const { rows: resultRows } = await getPostgresPool().query<CreditPackageRow>(
    [
      "SELECT id, label, credits, price_grosze, popular, active, sort_order, created_at, updated_at",
      "FROM credit_packages WHERE id = ANY($1::text[]) ORDER BY sort_order ASC, created_at ASC",
    ].join(" "),
    [ids]
  );
  return resultRows;
};

export const upsertLocalCreditPurchaseRows = async (rows: Array<Partial<CreditPurchaseRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapCreditPurchaseRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO credit_purchases",
          "(",
          "id, user_id, amount, paid_amount, credits, status, payment_provider, payment_session_id, payment_order_id, stripe_session_id, payu_order_id,",
          "billing_type, billing_name, billing_nip, billing_company, billing_address, billing_postal_code, billing_city,",
          "ksef_reference_number, ksef_invoice_number, ksef_session_reference_number, ksef_environment, ksef_sent_at, ksef_error,",
          "created_at, updated_at",
          ") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)",
          "ON CONFLICT (id) DO UPDATE SET",
          "user_id = EXCLUDED.user_id, amount = EXCLUDED.amount, paid_amount = EXCLUDED.paid_amount,",
          "credits = EXCLUDED.credits, status = EXCLUDED.status, payment_provider = EXCLUDED.payment_provider,",
          "payment_session_id = EXCLUDED.payment_session_id, payment_order_id = EXCLUDED.payment_order_id,",
          "stripe_session_id = EXCLUDED.stripe_session_id, payu_order_id = EXCLUDED.payu_order_id,",
          "billing_type = EXCLUDED.billing_type, billing_name = EXCLUDED.billing_name, billing_nip = EXCLUDED.billing_nip,",
          "billing_company = EXCLUDED.billing_company, billing_address = EXCLUDED.billing_address,",
          "billing_postal_code = EXCLUDED.billing_postal_code, billing_city = EXCLUDED.billing_city,",
          "ksef_reference_number = EXCLUDED.ksef_reference_number, ksef_invoice_number = EXCLUDED.ksef_invoice_number,",
          "ksef_session_reference_number = EXCLUDED.ksef_session_reference_number, ksef_environment = EXCLUDED.ksef_environment,",
          "ksef_sent_at = EXCLUDED.ksef_sent_at, ksef_error = EXCLUDED.ksef_error,",
          "created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at",
        ].join(" "),
        [
          row.id,
          row.user_id,
          row.amount,
          row.paid_amount,
          row.credits,
          row.status,
          row.payment_provider,
          row.payment_session_id,
          row.payment_order_id,
          row.stripe_session_id,
          row.payu_order_id,
          row.billing_type,
          row.billing_name,
          row.billing_nip,
          row.billing_company,
          row.billing_address,
          row.billing_postal_code,
          row.billing_city,
          row.ksef_reference_number,
          row.ksef_invoice_number,
          row.ksef_session_reference_number,
          row.ksef_environment,
          row.ksef_sent_at,
          row.ksef_error,
          row.created_at,
          row.updated_at,
        ]
      );
    }
  });

  const ids = normalizedRows.map((row) => row.id);
  const { rows: resultRows } = await getPostgresPool().query<CreditPurchaseRow>(
    [
      "SELECT",
      CREDIT_PURCHASES_SELECT,
      "FROM credit_purchases WHERE id = ANY($1::text[]) ORDER BY created_at DESC",
    ].join(" "),
    [ids]
  );
  return resultRows;
};

export const upsertLocalCreditUsageRows = async (rows: Array<Partial<CreditUsageRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapCreditUsageRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO credit_usage (id, user_id, credits_used, model, created_at)",
          "VALUES ($1, $2, $3, $4, $5)",
          "ON CONFLICT (id) DO UPDATE SET",
          "user_id = EXCLUDED.user_id, credits_used = EXCLUDED.credits_used,",
          "model = EXCLUDED.model, created_at = EXCLUDED.created_at",
        ].join(" "),
        [row.id, row.user_id, row.credits_used, row.model, row.created_at]
      );
    }
  });

  const ids = normalizedRows.map((row) => row.id);
  const { rows: resultRows } = await getPostgresPool().query<CreditUsageRow>(
    "SELECT id, user_id, credits_used, model, created_at FROM credit_usage WHERE id = ANY($1::text[]) ORDER BY created_at DESC",
    [ids]
  );
  return resultRows;
};

export const upsertLocalInvoiceSettingsRows = async (rows: Array<Partial<InvoiceSettingsRow>>) => {
  if (!hasLocalDatabase()) return [];

  const normalizedRows = rows.map(mapInvoiceSettingsRow);
  await withLocalClient(async (client) => {
    for (const row of normalizedRows) {
      await client.query(
        [
          "INSERT INTO invoice_settings",
          "(id, company_name, nip, address, postal_code, city, email, created_at, updated_at)",
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          "ON CONFLICT (id) DO UPDATE SET",
          "company_name = EXCLUDED.company_name, nip = EXCLUDED.nip, address = EXCLUDED.address,",
          "postal_code = EXCLUDED.postal_code, city = EXCLUDED.city, email = EXCLUDED.email,",
          "created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at",
        ].join(" "),
        [
          row.id,
          row.company_name,
          row.nip,
          row.address,
          row.postal_code,
          row.city,
          row.email,
          row.created_at,
          row.updated_at,
        ]
      );
    }
  });

  const ids = normalizedRows.map((row) => row.id);
  const { rows: resultRows } = await getPostgresPool().query<InvoiceSettingsRow>(
    [
      "SELECT id, company_name, nip, address, postal_code, city, email, created_at, updated_at",
      "FROM invoice_settings WHERE id = ANY($1::text[]) ORDER BY updated_at DESC",
    ].join(" "),
    [ids]
  );
  return resultRows;
};

export const listLocalCreditPackages = async ({ activeOnly = false }: { activeOnly?: boolean } = {}) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackCreditPackages(activeOnly);
  }

  await ensureLocalBillingSeeded();

  const query = [
    "SELECT id, label, credits, price_grosze, popular, active, sort_order, created_at, updated_at",
    "FROM credit_packages",
    activeOnly ? "WHERE active = true" : "",
    "ORDER BY sort_order ASC, created_at ASC",
  ]
    .filter(Boolean)
    .join(" ");

  const { rows } = await getPostgresPool().query<CreditPackageRow>(query);
  return rows;
};

export const getLocalCreditPackageById = async (id: string) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackCreditPackageById(id);
  }

  await ensureLocalBillingSeeded();
  const { rows } = await getPostgresPool().query<CreditPackageRow>(
    "SELECT id, label, credits, price_grosze, popular, active, sort_order, created_at, updated_at FROM credit_packages WHERE id = $1 LIMIT 1",
    [id]
  );

  if (rows[0]) return rows[0];

    const fallbackRow = await fetchFallbackCreditPackageById(id);
  if (fallbackRow) {
    const [savedRow] = await upsertLocalCreditPackageRows([fallbackRow]);
    return savedRow ?? fallbackRow;
  }

  return null;
};

export const getNextLocalCreditPackageSortOrder = async () => {
  if (!hasLocalDatabase()) {
    const packages = await fetchFallbackCreditPackages();
    const maxSortOrder = packages.reduce((max, row) => Math.max(max, row.sort_order), 0);
    return maxSortOrder + 1;
  }

  await ensureLocalBillingSeeded();
  const { rows } = await getPostgresPool().query<{ next_sort_order: number }>(
    "SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next_sort_order FROM credit_packages"
  );
  return Number(rows[0]?.next_sort_order ?? 1);
};

export const deleteLocalCreditPackage = async (id: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM credit_packages WHERE id = $1", [id]);
};

export const listLocalCreditPurchases = async (options: CreditPurchaseListOptions = {}) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackCreditPurchases(options);
  }

  await ensureLocalBillingSeeded();

  const conditions: string[] = [];
  const params: Array<string | string[] | number> = [];

  if (options.userId) {
    params.push(options.userId);
    conditions.push(`user_id = $${params.length}`);
  }

  if (typeof options.status === "string") {
    params.push(options.status);
    conditions.push(`status = $${params.length}`);
  } else if (Array.isArray(options.status) && options.status.length > 0) {
    params.push(options.status);
    conditions.push(`status = ANY($${params.length}::text[])`);
  }

  const limit = options.limit && options.limit > 0 ? Math.floor(options.limit) : null;
  if (limit) {
    params.push(limit);
  }

  const query = [
    "SELECT",
    CREDIT_PURCHASES_SELECT,
    "FROM credit_purchases",
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    `ORDER BY created_at ${options.latestFirst === false ? "ASC" : "DESC"}`,
    limit ? `LIMIT $${params.length}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const { rows } = await getPostgresPool().query<CreditPurchaseRow>(query, params);
  return rows;
};

export const getLocalCreditPurchaseById = async (id: string) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackCreditPurchaseById(id);
  }

  await ensureLocalBillingSeeded();
  const { rows } = await getPostgresPool().query<CreditPurchaseRow>(
    `SELECT ${CREDIT_PURCHASES_SELECT} FROM credit_purchases WHERE id = $1 LIMIT 1`,
    [id]
  );

  if (rows[0]) return rows[0];

    const fallbackRow = await fetchFallbackCreditPurchaseById(id);
  if (fallbackRow) {
    const [savedRow] = await upsertLocalCreditPurchaseRows([fallbackRow]);
    return savedRow ?? fallbackRow;
  }

  return null;
};

export const getLocalCreditPurchaseByStripeSessionId = async (sessionId: string) => {
  return getLocalCreditPurchaseByPaymentSessionId(sessionId);
};

export const getLocalCreditPurchaseByPaymentSessionId = async (sessionId: string) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackCreditPurchaseByStripeSessionId(sessionId);
  }

  await ensureLocalBillingSeeded();
  const { rows } = await getPostgresPool().query<CreditPurchaseRow>(
    `SELECT ${CREDIT_PURCHASES_SELECT} FROM credit_purchases WHERE payment_session_id = $1 OR stripe_session_id = $1 LIMIT 1`,
    [sessionId]
  );

  if (rows[0]) return rows[0];

    const fallbackRow = await fetchFallbackCreditPurchaseByStripeSessionId(sessionId);
  if (fallbackRow) {
    const [savedRow] = await upsertLocalCreditPurchaseRows([fallbackRow]);
    return savedRow ?? fallbackRow;
  }

  return null;
};

export const getLocalCreditPurchaseByPayuOrderId = async (orderId: string) => {
  return getLocalCreditPurchaseByPaymentOrderId(orderId);
};

export const getLocalCreditPurchaseByPaymentOrderId = async (orderId: string) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackCreditPurchaseByPayuOrderId(orderId);
  }

  await ensureLocalBillingSeeded();
  const { rows } = await getPostgresPool().query<CreditPurchaseRow>(
    `SELECT ${CREDIT_PURCHASES_SELECT} FROM credit_purchases WHERE payment_order_id = $1 OR payu_order_id = $1 LIMIT 1`,
    [orderId]
  );

  if (rows[0]) return rows[0];

  const fallbackRow = await fetchFallbackCreditPurchaseByPayuOrderId(orderId);
  if (fallbackRow) {
    const [savedRow] = await upsertLocalCreditPurchaseRows([fallbackRow]);
    return savedRow ?? fallbackRow;
  }

  return null;
};

export const createLocalCreditPurchase = async (row: Partial<CreditPurchaseRow>) => {
  const [savedRow] = await upsertLocalCreditPurchaseRows([row]);
  return savedRow ?? null;
};

export const updateLocalCreditPurchase = async (purchaseId: string, updates: Partial<CreditPurchaseRow>) => {
  const existing = await getLocalCreditPurchaseById(purchaseId);
  if (!existing) return null;

  const [savedRow] = await upsertLocalCreditPurchaseRows([
    {
      ...existing,
      ...updates,
      id: existing.id,
      user_id: existing.user_id,
      updated_at: new Date().toISOString(),
    },
  ]);

  return savedRow ?? existing;
};

export const deleteLocalCreditPurchaseById = async (purchaseId: string) => {
  if (!hasLocalDatabase()) return false;
  await ensureLocalDatabaseSchema();
  const { rowCount } = await getPostgresPool().query("DELETE FROM credit_purchases WHERE id = $1", [purchaseId]);
  return (rowCount ?? 0) > 0;
};

export const completeLocalCreditPurchase = async (
  sessionId: string,
  paidAmount?: number | null
): Promise<CompleteCreditPurchaseResult> => {
  if (!hasLocalDatabase()) {
    throw new Error("Local database is required to finalize credit purchases.");
  }

  await ensureLocalBillingSeeded();
  const client = await getPostgresPool().connect();

  try {
    await client.query("BEGIN");

    const { rows: purchaseRows } = await client.query<CreditPurchaseRow>(
      `SELECT ${CREDIT_PURCHASES_SELECT} FROM credit_purchases WHERE payment_session_id = $1 OR stripe_session_id = $1 LIMIT 1 FOR UPDATE`,
      [sessionId]
    );

    const purchase = purchaseRows[0] ?? null;
    if (!purchase) {
      await client.query("COMMIT");
      return { applied: false, purchase: null, balance: null };
    }

    if (purchase.status === "completed") {
      const { rows: balanceRows } = await client.query<{ balance: number }>(
        "SELECT balance FROM user_credits WHERE user_id = $1 LIMIT 1",
        [purchase.user_id]
      );
      await client.query("COMMIT");
      return {
        applied: false,
        purchase,
        balance: balanceRows[0] ? Number(balanceRows[0].balance) : null,
      };
    }

    const nextPaidAmount = paidAmount ?? purchase.paid_amount ?? null;
    const { rows: updatedPurchaseRows } = await client.query<CreditPurchaseRow>(
      [
        "UPDATE credit_purchases",
        "SET status = 'completed', paid_amount = $2, updated_at = now()",
        "WHERE payment_session_id = $1 OR stripe_session_id = $1",
        `RETURNING ${CREDIT_PURCHASES_SELECT}`,
      ].join(" "),
      [sessionId, nextPaidAmount]
    );

    const updatedPurchase = updatedPurchaseRows[0] ?? purchase;
    const { rows: balanceRows } = await client.query<{ balance: number }>(
      [
        "INSERT INTO user_credits (user_id, balance, created_at, updated_at)",
        "VALUES ($1, $2, now(), now())",
        "ON CONFLICT (user_id) DO UPDATE SET",
        "balance = user_credits.balance + EXCLUDED.balance, updated_at = now()",
        "RETURNING balance",
      ].join(" "),
      [updatedPurchase.user_id, updatedPurchase.credits]
    );

    await client.query("COMMIT");
    return {
      applied: true,
      purchase: updatedPurchase,
      balance: balanceRows[0] ? Number(balanceRows[0].balance) : null,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const deleteLocalCreditPurchasesByUserId = async (userId: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM credit_purchases WHERE user_id = $1", [userId]);
};

export const listLocalCreditUsage = async (options: CreditUsageListOptions = {}) => {
  if (!hasLocalDatabase()) {
    return fetchFallbackCreditUsage(options);
  }

  await ensureLocalBillingSeeded();

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (options.userId) {
    params.push(options.userId);
    conditions.push(`user_id = $${params.length}`);
  }

  if (options.since) {
    params.push(options.since);
    conditions.push(`created_at >= $${params.length}`);
  }

  const limit = options.limit && options.limit > 0 ? Math.floor(options.limit) : null;
  if (limit) {
    params.push(limit);
  }

  const query = [
    "SELECT id, user_id, credits_used, model, created_at",
    "FROM credit_usage",
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    `ORDER BY created_at ${options.latestFirst === false ? "ASC" : "DESC"}`,
    limit ? `LIMIT $${params.length}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const { rows } = await getPostgresPool().query<CreditUsageRow>(query, params);
  return rows;
};

export const getLocalCreditUsageTotalSince = async (userId: string, since: string) => {
  if (!hasLocalDatabase()) {
    const rows = await fetchFallbackCreditUsage({ userId, since });
    return rows.reduce((sum, row) => sum + Number(row.credits_used || 0), 0);
  }

  await ensureLocalBillingSeeded();
  const { rows } = await getPostgresPool().query<{ total: string | number | null }>(
    "SELECT COALESCE(SUM(credits_used), 0) AS total FROM credit_usage WHERE user_id = $1 AND created_at >= $2",
    [userId, since]
  );

  return Number(rows[0]?.total ?? 0);
};

export const deleteLocalCreditUsageByUserId = async (userId: string) => {
  if (!hasLocalDatabase()) return;
  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM credit_usage WHERE user_id = $1", [userId]);
};

export const getLocalInvoiceSettings = async ({ ensureDefault = false }: { ensureDefault?: boolean } = {}) => {
  if (!hasLocalDatabase()) {
    const row = await fetchFallbackInvoiceSettings();
    return row ?? (ensureDefault ? mapInvoiceSettingsRow({}) : null);
  }

  await ensureLocalBillingSeeded();

  const { rows } = await getPostgresPool().query<InvoiceSettingsRow>(
    [
      "SELECT id, company_name, nip, address, postal_code, city, email, created_at, updated_at",
      "FROM invoice_settings ORDER BY updated_at DESC, created_at DESC LIMIT 1",
    ].join(" ")
  );

  if (rows[0]) return rows[0];

    const fallbackRow = await fetchFallbackInvoiceSettings();
  if (fallbackRow) {
    const [savedRow] = await upsertLocalInvoiceSettingsRows([fallbackRow]);
    return savedRow ?? fallbackRow;
  }

  if (!ensureDefault) return null;

  const defaultRow = mapInvoiceSettingsRow({});
  const [savedRow] = await upsertLocalInvoiceSettingsRows([defaultRow]);
  return savedRow ?? defaultRow;
};
