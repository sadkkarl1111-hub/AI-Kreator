import path from "node:path";
import sharp from "sharp";
import {
  storagePathToRelativePath,
  toLocalStoragePath,
} from "./localFiles.js";
import { deleteStorageFile, getStorageDisplayUrl, readStorageFile, toRemoteStoragePath, writeStorageFile } from "./storage.js";

const THUMBNAIL_WIDTH = 360;
const thumbnailPathsKnownToExist = new Set<string>();

export const getGraphicsStoragePath = (urlOrPath: string | null) => {
  if (!urlOrPath) return null;
  if (!urlOrPath.startsWith("http")) return urlOrPath;

  try {
    const parsedUrl = new URL(urlOrPath);
    const publicMarker = "/storage/v1/object/public/graphics/";
    const signedMarker = "/storage/v1/object/sign/graphics/";

    if (parsedUrl.pathname.includes(publicMarker)) {
      return decodeURIComponent(parsedUrl.pathname.split(publicMarker)[1] || "");
    }

    if (parsedUrl.pathname.includes(signedMarker)) {
      return decodeURIComponent(parsedUrl.pathname.split(signedMarker)[1] || "");
    }
  } catch {
    return null;
  }

  return null;
};

const graphicRelativePath = (storagePath: string) => {
  const relativePath = storagePathToRelativePath(storagePath);
  return relativePath.startsWith("graphics/") ? relativePath : `graphics/${relativePath}`;
};

const graphicStoragePath = (storagePath: string) => {
  const relativePath = graphicRelativePath(storagePath);

  if (storagePath.startsWith("local:")) {
    return toLocalStoragePath(relativePath);
  }

  if (storagePath.startsWith("s3:")) {
    return toRemoteStoragePath(relativePath);
  }

  return relativePath;
};

const graphicThumbnailRelativePath = (storagePath: string) => {
  const relativePath = graphicRelativePath(storagePath);
  const parsedPath = path.posix.parse(relativePath);
  const baseWithoutExtension = path.posix.join(
    parsedPath.dir.replace(/\\/g, "/"),
    parsedPath.name
  );

  return `graphics-thumbnails/${baseWithoutExtension}-${THUMBNAIL_WIDTH}.webp`;
};

const graphicThumbnailStoragePath = (storagePath: string) => {
  const relativePath = graphicThumbnailRelativePath(storagePath);

  if (storagePath.startsWith("s3:")) {
    return toRemoteStoragePath(relativePath);
  }

  return toLocalStoragePath(relativePath);
};

const ensureGraphicThumbnail = async (storagePath: string) => {
  const sourceStoragePath = graphicStoragePath(storagePath);
  const thumbnailStoragePath = graphicThumbnailStoragePath(storagePath);

  if (thumbnailPathsKnownToExist.has(thumbnailStoragePath)) {
    return thumbnailStoragePath;
  }

  try {
    await readStorageFile(thumbnailStoragePath);
    thumbnailPathsKnownToExist.add(thumbnailStoragePath);
    return thumbnailStoragePath;
  } catch {
    // Generate below.
  }

  const sourceBuffer = await readStorageFile(sourceStoragePath);
  const thumbnailBuffer = await sharp(sourceBuffer, { limitInputPixels: 32_000_000 })
    .rotate()
    .resize({
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_WIDTH,
      fit: "cover",
      withoutEnlargement: true,
    })
    .webp({ quality: 78 })
    .toBuffer();

  await writeStorageFile(graphicThumbnailRelativePath(storagePath), thumbnailBuffer, { contentType: "image/webp" });
  thumbnailPathsKnownToExist.add(thumbnailStoragePath);

  return thumbnailStoragePath;
};

export const getGraphicDisplayUrl = async (urlOrPath: string | null) => {
  const storagePath = getGraphicsStoragePath(urlOrPath);
  if (!storagePath) return null;

  return getStorageDisplayUrl(graphicStoragePath(storagePath));
};

export const getGraphicThumbnailDisplayUrl = async (urlOrPath: string | null) => {
  const storagePath = getGraphicsStoragePath(urlOrPath);
  if (!storagePath) return null;

  try {
    const thumbnailStoragePath = await ensureGraphicThumbnail(storagePath);
    return getStorageDisplayUrl(thumbnailStoragePath);
  } catch {
    return getGraphicDisplayUrl(urlOrPath);
  }
};

export const deleteGraphicFile = async (urlOrPath: string | null) => {
  const storagePath = getGraphicsStoragePath(urlOrPath);
  if (!storagePath) return;

  await Promise.allSettled([
    deleteStorageFile(graphicStoragePath(storagePath)),
    deleteStorageFile(graphicThumbnailStoragePath(storagePath)),
  ]);
};
