import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

export const LOCAL_STORAGE_PREFIX = "local:";
export const REMOTE_STORAGE_PREFIX = "s3:";

export const normalizeRelativePath = (relativePath: string) => {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");

  if (!normalized || normalized.split("/").some((part) => part === "..")) {
    throw new Error("Nieprawidlowa sciezka pliku.");
  }

  return normalized;
};

export const getLocalFilePath = (relativePath: string) => {
  return path.join(env.uploadDir, normalizeRelativePath(relativePath));
};

export const localFileExists = async (relativePath: string) => {
  try {
    await access(getLocalFilePath(relativePath));
    return true;
  } catch {
    return false;
  }
};

export const localFileUrl = (relativePath: string) => {
  const baseUrl = (env.publicFilesUrl || `${env.apiUrl.replace(/\/$/, "")}/files`).replace(/\/$/, "");
  return `${baseUrl}/${normalizeRelativePath(relativePath)}`;
};

export const storagePathToRelativePath = (storagePath: string) => {
  if (storagePath.startsWith(LOCAL_STORAGE_PREFIX)) {
    return normalizeRelativePath(storagePath.slice(LOCAL_STORAGE_PREFIX.length));
  }

  if (storagePath.startsWith(REMOTE_STORAGE_PREFIX)) {
    return normalizeRelativePath(storagePath.slice(REMOTE_STORAGE_PREFIX.length));
  }

  return normalizeRelativePath(storagePath);
};

export const toLocalStoragePath = (relativePath: string) => {
  return `${LOCAL_STORAGE_PREFIX}${normalizeRelativePath(relativePath)}`;
};

export const writeLocalFile = async (relativePath: string, buffer: Buffer) => {
  const targetPath = getLocalFilePath(relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer);
};

export const readLocalFile = async (relativePath: string) => {
  return readFile(getLocalFilePath(relativePath));
};

export const deleteLocalFile = async (relativePath: string) => {
  await rm(getLocalFilePath(relativePath), { force: true });
};
