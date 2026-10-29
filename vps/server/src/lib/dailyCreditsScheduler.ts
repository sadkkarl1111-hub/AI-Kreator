import { grantLocalDailyFreeCredits } from "./localDailyCredits.js";
import { hasLocalDatabase } from "./postgres.js";

const DAILY_CREDITS_INTERVAL_MS = 30 * 60 * 1000;

let dailyCreditsInterval: NodeJS.Timeout | null = null;
let dailyCreditsBootTimeout: NodeJS.Timeout | null = null;
let dailyCreditsJobRunning = false;

const runDailyCreditsJob = async (trigger: "startup" | "interval") => {
  if (!hasLocalDatabase() || dailyCreditsJobRunning) {
    return;
  }

  dailyCreditsJobRunning = true;

  try {
    const result = await grantLocalDailyFreeCredits();
    console.log(`[daily-credits:${trigger}]`, result);
  } catch (error) {
    console.error(`[daily-credits:${trigger}] failed`, error);
  } finally {
    dailyCreditsJobRunning = false;
  }
};

export const startDailyCreditsScheduler = () => {
  if (!hasLocalDatabase()) {
    console.log("[daily-credits] scheduler skipped, local database disabled");
    return;
  }

  if (dailyCreditsInterval) {
    return;
  }

  dailyCreditsBootTimeout = setTimeout(() => {
    dailyCreditsBootTimeout = null;
    void runDailyCreditsJob("startup");
  }, 15_000);
  dailyCreditsBootTimeout.unref?.();

  dailyCreditsInterval = setInterval(() => {
    void runDailyCreditsJob("interval");
  }, DAILY_CREDITS_INTERVAL_MS);
  dailyCreditsInterval.unref?.();

  console.log(
    `[daily-credits] scheduler started, checking every ${Math.round(
      DAILY_CREDITS_INTERVAL_MS / (60 * 1000)
    )} minutes`
  );
};
