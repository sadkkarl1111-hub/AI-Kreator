import { createApp } from "./app.js";
import { env, validateProductionEnv } from "./config/env.js";
import { refreshLocalAiModelCatalog, refreshLocalLegalContentForTpay, syncLocalCoreData } from "./lib/localCoreData.js";
import { startDailyCreditsScheduler } from "./lib/dailyCreditsScheduler.js";
import { syncLocalUserData } from "./lib/localUserData.js";
import { ensureLocalDatabaseSchema, hasLocalDatabase } from "./lib/postgres.js";

const startServer = async () => {
  validateProductionEnv();

  if (hasLocalDatabase()) {
    try {
      await ensureLocalDatabaseSchema();
      const [coreSyncResult, userSyncResult] = await Promise.all([
        syncLocalCoreData({ onlyIfEmpty: true }),
        syncLocalUserData({ onlyIfEmpty: true }),
      ]);
      const legalRefreshResult = await refreshLocalLegalContentForTpay();
      const aiModelRefreshResult = await refreshLocalAiModelCatalog();
      console.log("Local core data bootstrap:", coreSyncResult);
      console.log("Local user data bootstrap:", userSyncResult);
      console.log("Local legal content refresh:", legalRefreshResult);
      console.log("Local AI model catalog refresh:", aiModelRefreshResult);
    } catch (error) {
      console.error("Local VPS data bootstrap failed:", error);
    }
  }

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`VPS API listening on port ${env.port}`);
    startDailyCreditsScheduler();
  });
};

startServer().catch((error) => {
  console.error("Failed to start VPS API:", error);
  process.exit(1);
});
