import {
  ensureLocalDatabaseSchema,
  getPostgresPool,
  hasLocalDatabase,
} from "./postgres.js";
import { getLocalSettingsMap } from "./localCoreData.js";
import { getLocalUserCredit, listLocalAuthUsers, syncLocalUserData } from "./localUserData.js";

const DEFAULT_DAILY_FREE_CREDITS_AMOUNT = 5;
const DEFAULT_DAILY_FREE_CREDITS_BALANCE_CAP = 200;
const DAILY_CREDITS_TIMEZONE = "Europe/Warsaw";

export const DAILY_FREE_CREDITS_AMOUNT_SETTING_KEY = "daily_free_credits_amount";
export const DAILY_FREE_CREDITS_BALANCE_CAP_SETTING_KEY = "daily_free_credits_balance_cap";

type GrantDailyFreeCreditsOptions = {
  force?: boolean;
};

type DailyFreeCreditsConfig = {
  amount: number;
  balanceCap: number;
};

export type GrantDailyFreeCreditsResult = {
  skipped: boolean;
  updatedUsers: number;
  runDate: string;
  creditsAddedPerUser: number;
  balanceCap: number;
};

export type GrantDailyFreeCreditsForUserResult = {
  skipped: boolean;
  updated: boolean;
  runDate: string;
  userId: string;
  creditsAdded: number;
  balanceCap: number;
};

const getWarsawDateKey = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: DAILY_CREDITS_TIMEZONE,
  }).format(new Date());

const parseNonNegativeInteger = (value: string | undefined, fallback: number) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return fallback;

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
};

export const getLocalDailyFreeCreditsConfig = async (): Promise<DailyFreeCreditsConfig> => {
  if (!hasLocalDatabase()) {
    return {
      amount: DEFAULT_DAILY_FREE_CREDITS_AMOUNT,
      balanceCap: DEFAULT_DAILY_FREE_CREDITS_BALANCE_CAP,
    };
  }

  const settings = await getLocalSettingsMap([
    DAILY_FREE_CREDITS_AMOUNT_SETTING_KEY,
    DAILY_FREE_CREDITS_BALANCE_CAP_SETTING_KEY,
  ]);

  const amount = parseNonNegativeInteger(
    settings[DAILY_FREE_CREDITS_AMOUNT_SETTING_KEY],
    DEFAULT_DAILY_FREE_CREDITS_AMOUNT
  );
  const balanceCap = Math.max(
    parseNonNegativeInteger(
      settings[DAILY_FREE_CREDITS_BALANCE_CAP_SETTING_KEY],
      DEFAULT_DAILY_FREE_CREDITS_BALANCE_CAP
    ),
    amount
  );

  return {
    amount,
    balanceCap,
  };
};

const ensureLocalCreditRowsForKnownUsers = async () => {
  const authUsers = await listLocalAuthUsers();
  if (!authUsers.length) return 0;

  const { rowCount } = await getPostgresPool().query(
    [
      "INSERT INTO user_credits (user_id, balance)",
      "SELECT auth_users.user_id, 0",
      "FROM auth_users",
      "LEFT JOIN user_credits ON user_credits.user_id = auth_users.user_id",
      "WHERE user_credits.user_id IS NULL",
      "ON CONFLICT (user_id) DO NOTHING",
    ].join(" ")
  );

  return rowCount ?? 0;
};

const ensureLocalCreditRowForUser = async (userId: string) => {
  const existing = await getLocalUserCredit(userId);
  if (existing) return existing;

  await getPostgresPool().query(
    [
      "INSERT INTO user_credits (user_id, balance)",
      "VALUES ($1, 0)",
      "ON CONFLICT (user_id) DO NOTHING",
    ].join(" "),
    [userId]
  );

  return getLocalUserCredit(userId);
};

export const grantLocalDailyFreeCreditsForUser = async (
  userId: string,
  { force = false }: GrantDailyFreeCreditsOptions = {}
): Promise<GrantDailyFreeCreditsForUserResult> => {
  const runDate = getWarsawDateKey();
  const config = await getLocalDailyFreeCreditsConfig();

  if (!hasLocalDatabase()) {
    return {
      skipped: true,
      updated: false,
      runDate,
      userId,
      creditsAdded: config.amount,
      balanceCap: config.balanceCap,
    };
  }

  if (config.amount <= 0) {
    return {
      skipped: true,
      updated: false,
      runDate,
      userId,
      creditsAdded: 0,
      balanceCap: config.balanceCap,
    };
  }

  await ensureLocalDatabaseSchema();
  await ensureLocalCreditRowForUser(userId);

  const { rows } = await getPostgresPool().query<{
    user_id: string;
    last_daily_free_credits_date: string | null;
  }>(
    [
      "UPDATE user_credits",
      "SET balance = LEAST(balance + $1, $2),",
      "updated_at = now(),",
      "last_daily_free_credits_date = $3",
      "WHERE user_id = $4",
      "AND balance < $2",
      "AND ($5 OR last_daily_free_credits_date IS NULL OR last_daily_free_credits_date <> $3)",
      "RETURNING user_id, last_daily_free_credits_date::text",
    ].join(" "),
    [config.amount, config.balanceCap, runDate, userId, force]
  );

  return {
    skipped: rows.length === 0,
    updated: rows.length > 0,
    runDate,
    userId,
    creditsAdded: config.amount,
    balanceCap: config.balanceCap,
  };
};

export const grantLocalDailyFreeCredits = async ({
  force = false,
}: GrantDailyFreeCreditsOptions = {}): Promise<GrantDailyFreeCreditsResult> => {
  const runDate = getWarsawDateKey();
  const config = await getLocalDailyFreeCreditsConfig();

  if (!hasLocalDatabase()) {
    return {
      skipped: true,
      updatedUsers: 0,
      runDate,
      creditsAddedPerUser: config.amount,
      balanceCap: config.balanceCap,
    };
  }

  if (config.amount <= 0) {
    return {
      skipped: true,
      updatedUsers: 0,
      runDate,
      creditsAddedPerUser: 0,
      balanceCap: config.balanceCap,
    };
  }

  await ensureLocalDatabaseSchema();
  await syncLocalUserData({ onlyIfEmpty: true });
  await ensureLocalCreditRowsForKnownUsers();

  const { rowCount } = await getPostgresPool().query(
    [
      "UPDATE user_credits",
      "SET balance = LEAST(balance + $1, $2),",
      "updated_at = now(),",
      "last_daily_free_credits_date = $3",
      "WHERE balance < $2",
      "AND ($4 OR last_daily_free_credits_date IS NULL OR last_daily_free_credits_date <> $3)",
    ].join(" "),
    [config.amount, config.balanceCap, runDate, force]
  );

  return {
    skipped: (rowCount ?? 0) === 0,
    updatedUsers: rowCount ?? 0,
    runDate,
    creditsAddedPerUser: config.amount,
    balanceCap: config.balanceCap,
  };
};
