import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Response } from "express";
import { env } from "../config/env.js";
import {
  LOCAL_STORAGE_PREFIX,
  REMOTE_STORAGE_PREFIX,
  deleteLocalFile,
  getLocalFilePath,
  localFileExists,
  localFileUrl,
  normalizeRelativePath,
  readLocalFile,
  storagePathToRelativePath,
  toLocalStoragePath,
  writeLocalFile,
} from "./localFiles.js";

type WriteStorageOptions = {
  contentType?: string;
};

const REMOTE_STORAGE_DRIVERS = new Set(["s3", "r2"]);
const DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable";

let remoteClient: S3Client | null = null;

const getStorageDriver = () => String(env.storageDriver || "local").trim().toLowerCase();

export const isRemoteStorageConfigured = () => {
  return (
    REMOTE_STORAGE_DRIVERS.has(getStorageDriver()) &&
    Boolean(env.s3Endpoint && env.s3Bucket && env.s3AccessKeyId && env.s3SecretAccessKey)
  );
};

const getRemoteClient = () => {
  if (!isRemoteStorageConfigured()) {
    throw new Error("Zdalny storage nie jest skonfigurowany.");
  }

  if (!remoteClient) {
    remoteClient = new S3Client({
      region: env.s3Region || "auto",
      endpoint: env.s3Endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.s3AccessKeyId,
        secretAccessKey: env.s3SecretAccessKey,
      },
    });
  }

  return remoteClient;
};

const getRemoteObjectKey = (relativePath: string) => normalizeRelativePath(relativePath);

const getMimeTypeFromPath = (filePath: string) => {
  const normalized = filePath.toLowerCase();
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".svg")) return "image/svg+xml";
  if (normalized.endsWith(".json")) return "application/json";
  return "image/png";
};

const bodyToBuffer = async (body: unknown): Promise<Buffer> => {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }

  if (typeof (body as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === "function") {
    const arrayBuffer = await (body as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array | string>) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(Buffer.from(chunk));
    }
  }

  return Buffer.concat(chunks);
};

const readRemoteFile = async (relativePath: string) => {
  const client = getRemoteClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.s3Bucket,
      Key: getRemoteObjectKey(relativePath),
    })
  );

  return bodyToBuffer(response.Body);
};

const writeRemoteFile = async (relativePath: string, buffer: Buffer, options?: WriteStorageOptions) => {
  const client = getRemoteClient();
  await client.send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: getRemoteObjectKey(relativePath),
      Body: buffer,
      ContentType: options?.contentType || getMimeTypeFromPath(relativePath),
      CacheControl: DEFAULT_CACHE_CONTROL,
    })
  );
};

const deleteRemoteFile = async (relativePath: string) => {
  if (!isRemoteStorageConfigured()) {
    return;
  }

  const client = getRemoteClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.s3Bucket,
      Key: getRemoteObjectKey(relativePath),
    })
  );
};

export const toRemoteStoragePath = (relativePath: string) => {
  return `${REMOTE_STORAGE_PREFIX}${normalizeRelativePath(relativePath)}`;
};

export const writeStorageFile = async (relativePath: string, buffer: Buffer, options?: WriteStorageOptions) => {
  const normalized = normalizeRelativePath(relativePath);

  if (isRemoteStorageConfigured()) {
    await writeRemoteFile(normalized, buffer, options);
    return toRemoteStoragePath(normalized);
  }

  await writeLocalFile(normalized, buffer);
  return toLocalStoragePath(normalized);
};

export const readStorageFile = async (storagePath: string) => {
  const relativePath = storagePathToRelativePath(storagePath);

  if (storagePath.startsWith(REMOTE_STORAGE_PREFIX)) {
    return readRemoteFile(relativePath);
  }

  if (storagePath.startsWith(LOCAL_STORAGE_PREFIX)) {
    if (await localFileExists(relativePath)) {
      return readLocalFile(relativePath);
    }

    if (isRemoteStorageConfigured()) {
      return readRemoteFile(relativePath);
    }

    return readLocalFile(relativePath);
  }

  if (await localFileExists(relativePath)) {
    return readLocalFile(relativePath);
  }

  return readRemoteFile(relativePath);
};

export const deleteStorageFile = async (storagePath: string) => {
  const relativePath = storagePathToRelativePath(storagePath);

  if (storagePath.startsWith(REMOTE_STORAGE_PREFIX)) {
    await deleteRemoteFile(relativePath);
    return;
  }

  if (storagePath.startsWith(LOCAL_STORAGE_PREFIX)) {
    if (await localFileExists(relativePath)) {
      await deleteLocalFile(relativePath);
      return;
    }

    if (isRemoteStorageConfigured()) {
      await deleteRemoteFile(relativePath);
      return;
    }

    await deleteLocalFile(relativePath);
    return;
  }

  if (await localFileExists(relativePath)) {
    await deleteLocalFile(relativePath);
    return;
  }

  await deleteRemoteFile(relativePath);
};

export const getStorageDisplayUrl = async (storagePath: string) => {
  const relativePath = storagePathToRelativePath(storagePath);

  if (storagePath.startsWith(LOCAL_STORAGE_PREFIX) || storagePath.startsWith(REMOTE_STORAGE_PREFIX)) {
    return localFileUrl(relativePath);
  }

  if (await localFileExists(relativePath)) {
    return localFileUrl(relativePath);
  }

  if (isRemoteStorageConfigured()) {
    return localFileUrl(relativePath);
  }

  return null;
};

export const serveStorageFile = async (relativePath: string, response: Response) => {
  const normalized = normalizeRelativePath(relativePath);

  if (await localFileExists(normalized)) {
    response.sendFile(getLocalFilePath(normalized));
    return true;
  }

  if (!isRemoteStorageConfigured()) {
    return false;
  }

  try {
    const client = getRemoteClient();
    const objectResponse = await client.send(
      new GetObjectCommand({
        Bucket: env.s3Bucket,
        Key: getRemoteObjectKey(normalized),
      })
    );

    const buffer = await bodyToBuffer(objectResponse.Body);
    response.setHeader("Content-Type", objectResponse.ContentType || getMimeTypeFromPath(normalized));
    response.setHeader("Cache-Control", objectResponse.CacheControl || DEFAULT_CACHE_CONTROL);

    if (typeof objectResponse.ContentLength === "number" && Number.isFinite(objectResponse.ContentLength)) {
      response.setHeader("Content-Length", String(objectResponse.ContentLength));
    }

    response.send(buffer);
    return true;
  } catch {
    return false;
  }
};
