import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import {
  LOCAL_STORAGE_PREFIX,
  REMOTE_STORAGE_PREFIX,
  normalizeRelativePath,
  storagePathToRelativePath,
} from "../lib/localFiles.js";
import { ensureLocalDatabaseSchema, getPostgresPool, hasLocalDatabase } from "../lib/postgres.js";
import { isRemoteStorageConfigured, writeStorageFile } from "../lib/storage.js";

type GraphicsRow = {
  id: string;
  url: string | null;
};

type BadgeRow = {
  id: string;
  storage_path: string;
};

type MigrationSummary = {
  scannedFiles: number;
  uploadedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  graphicsUpdated: number;
  badgesUpdated: number;
  missingGraphicFiles: number;
  missingBadgeFiles: number;
};

const walkDirectory = async (directoryPath: string): Promise<string[]> => {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDirectory(absolutePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
};

const toRelativeStoragePath = (absolutePath: string) => {
  return normalizeRelativePath(path.relative(env.uploadDir, absolutePath).split(path.sep).join("/"));
};

const shouldRewriteToRemote = (storagePath: string | null | undefined) => {
  if (!storagePath) return false;
  if (storagePath.startsWith(REMOTE_STORAGE_PREFIX)) return false;
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) return false;
  return true;
};

const run = async () => {
  if (!isRemoteStorageConfigured()) {
    throw new Error("R2 / S3 storage nie jest skonfigurowany. Ustaw STORAGE_DRIVER=s3 i S3_* w .env.");
  }

  const summary: MigrationSummary = {
    scannedFiles: 0,
    uploadedFiles: 0,
    failedFiles: 0,
    skippedFiles: 0,
    graphicsUpdated: 0,
    badgesUpdated: 0,
    missingGraphicFiles: 0,
    missingBadgeFiles: 0,
  };

  const localFiles = await walkDirectory(env.uploadDir).catch(() => [] as string[]);
  const remoteMap = new Map<string, string>();

  for (const absolutePath of localFiles) {
    const fileStats = await stat(absolutePath).catch(() => null);
    if (!fileStats?.isFile()) {
      summary.skippedFiles += 1;
      continue;
    }

    const relativePath = toRelativeStoragePath(absolutePath);
    summary.scannedFiles += 1;

    try {
      const buffer = await readFile(absolutePath);
      const remoteStoragePath = await writeStorageFile(relativePath, buffer);
      remoteMap.set(relativePath, remoteStoragePath);
      remoteMap.set(`${LOCAL_STORAGE_PREFIX}${relativePath}`, remoteStoragePath);
      summary.uploadedFiles += 1;
    } catch (error) {
      summary.failedFiles += 1;
      console.error(`Nie udalo sie przeslac pliku ${relativePath}:`, error);
    }
  }

  if (hasLocalDatabase()) {
    await ensureLocalDatabaseSchema();
    const pool = getPostgresPool();

    const { rows: graphicRows } = await pool.query<GraphicsRow>(
      "SELECT id, url FROM graphics WHERE url IS NOT NULL ORDER BY created_at ASC"
    );

    for (const row of graphicRows) {
      if (!shouldRewriteToRemote(row.url)) continue;

      const relativePath = storagePathToRelativePath(row.url!);
      const remoteStoragePath = remoteMap.get(row.url!) || remoteMap.get(relativePath);

      if (!remoteStoragePath) {
        summary.missingGraphicFiles += 1;
        continue;
      }

      if (remoteStoragePath === row.url) continue;

      await pool.query("UPDATE graphics SET url = $2 WHERE id = $1", [row.id, remoteStoragePath]);
      summary.graphicsUpdated += 1;
    }

    const { rows: badgeRows } = await pool.query<BadgeRow>(
      "SELECT id, storage_path FROM admin_badges WHERE storage_path IS NOT NULL ORDER BY created_at ASC"
    );

    for (const row of badgeRows) {
      if (!shouldRewriteToRemote(row.storage_path)) continue;

      const relativePath = storagePathToRelativePath(row.storage_path);
      const remoteStoragePath = remoteMap.get(row.storage_path) || remoteMap.get(relativePath);

      if (!remoteStoragePath) {
        summary.missingBadgeFiles += 1;
        continue;
      }

      if (remoteStoragePath === row.storage_path) continue;

      await pool.query("UPDATE admin_badges SET storage_path = $2 WHERE id = $1", [row.id, remoteStoragePath]);
      summary.badgesUpdated += 1;
    }
  }

  console.log(JSON.stringify(summary, null, 2));
};

run().catch((error) => {
  console.error("Migracja local -> R2 nie powiodla sie:", error);
  process.exitCode = 1;
});
