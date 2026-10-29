import { randomUUID } from "node:crypto";
import {
  storagePathToRelativePath,
  toLocalStoragePath,
} from "./localFiles.js";
import { deleteStorageFile, getStorageDisplayUrl, toRemoteStoragePath, writeStorageFile } from "./storage.js";

const badgeRelativePath = (storagePath: string) => {
  const relativePath = storagePathToRelativePath(storagePath);
  return relativePath.startsWith("badges/") ? relativePath : `badges/${relativePath}`;
};

const badgeStoragePath = (storagePath: string) => {
  const relativePath = badgeRelativePath(storagePath);

  if (storagePath.startsWith("local:")) {
    return toLocalStoragePath(relativePath);
  }

  if (storagePath.startsWith("s3:")) {
    return toRemoteStoragePath(relativePath);
  }

  return relativePath;
};

export const getFileExtension = (fileName?: string, fileType?: string) => {
  const fromName = fileName?.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (fromName) return fromName;

  if (fileType?.includes("svg")) return "svg";
  if (fileType?.includes("webp")) return "webp";
  if (fileType?.includes("jpeg") || fileType?.includes("jpg")) return "jpg";
  return "png";
};

export const saveBadgeFile = async (fileName: string | undefined, fileType: string | undefined, buffer: Buffer) => {
  const extension = getFileExtension(fileName, fileType);
  const relativePath = `badges/${randomUUID()}.${extension}`;
  const storagePath = await writeStorageFile(relativePath, buffer, { contentType: fileType });

  return {
    storagePath,
    publicUrl: await getStorageDisplayUrl(storagePath),
  };
};

export const getBadgePublicUrl = async (storagePath: string) => {
  return getStorageDisplayUrl(badgeStoragePath(storagePath));
};

export const deleteBadgeFile = async (storagePath: string) => {
  await deleteStorageFile(badgeStoragePath(storagePath));
};
