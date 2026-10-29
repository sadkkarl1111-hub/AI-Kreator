import { Router } from "express";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { deleteGraphicFile, getGraphicDisplayUrl, getGraphicThumbnailDisplayUrl, getGraphicsStoragePath } from "../lib/graphics.js";
import {
  createLocalGraphic,
  deleteLocalGraphicsByIds,
  ensureLocalGraphicShareToken,
  getLocalGraphicById,
  getLocalGraphicByUserAndId,
  listLocalGraphicsByIdsForUser,
  listLocalGraphicsByParentId,
  listLocalGraphicsByUser,
  listLocalToolGalleryGraphics,
  LocalGraphicRow,
  recordLocalGraphicHistoryEntry,
  setLocalGraphicPublic,
  trimLocalSavedGraphics,
} from "../lib/localGraphicsData.js";
import { hasLocalUserRole } from "../lib/localUserData.js";
import { writeStorageFile } from "../lib/storage.js";
import { requireAuthenticatedUser } from "../middleware/requireAuthenticatedUser.js";

type GalleryFilter = "all" | "generated" | "template";

type TimelineGraphicRow = {
  id: string;
  url: string | null;
  prompt: string;
  created_at: string;
  parent_id: string | null;
  user_id: string | null;
};

type ToolGalleryGraphicRow = {
  id: string;
  url: string | null;
  prompt: string | null;
};

export const galleryRouter = Router();
const MAX_SAVED_GRAPHICS = 50;
const MAX_UPLOAD_BASE64_LENGTH = 14 * 1024 * 1024;
const MAX_UPLOAD_PIXELS = 32_000_000;
const MAX_UPLOAD_DIMENSION = 4096;

const getIsAdmin = async (userId: string) => {
  return hasLocalUserRole(userId, "admin");
};

const normalizeFilter = (value: unknown): GalleryFilter => {
  if (value === "generated" || value === "template") return value;
  return "all";
};

const getContentTypeFromDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:([^;]+);base64,/i);
  return match?.[1] || "image/png";
};

const SUPPORTED_UPLOAD_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const getBase64Payload = (dataUrl: string) => {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
};

const prepareSafeImageUpload = async (dataUrl: string) => {
  if (!dataUrl.startsWith("data:image/")) {
    const error = new Error("Nieprawidlowy obraz.");
    error.name = "BadImage";
    throw error;
  }

  const contentType = getContentTypeFromDataUrl(dataUrl).toLowerCase();
  if (!SUPPORTED_UPLOAD_CONTENT_TYPES.has(contentType)) {
    const error = new Error("Ten format obrazu nie jest obslugiwany. Wgraj JPG, PNG albo WebP.");
    error.name = "BadImage";
    throw error;
  }

  const payload = getBase64Payload(dataUrl).replace(/\s+/g, "");
  if (!payload || payload.length > MAX_UPLOAD_BASE64_LENGTH) {
    const error = new Error("Obraz jest za duzy. Wgraj mniejszy plik.");
    error.name = "PayloadTooLarge";
    throw error;
  }

  const sourceBuffer = Buffer.from(payload, "base64");
  const image = sharp(sourceBuffer, { limitInputPixels: MAX_UPLOAD_PIXELS }).rotate();
  const metadata = await image.metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const format = String(metadata.format || "").toLowerCase();

  if (!width || !height || !["jpeg", "jpg", "png", "webp"].includes(format)) {
    const error = new Error("Nie udalo sie potwierdzic, ze plik jest bezpiecznym obrazem.");
    error.name = "BadImage";
    throw error;
  }

  if (width * height > MAX_UPLOAD_PIXELS) {
    const error = new Error("Obraz ma zbyt duza rozdzielczosc. Zmniejsz plik i sproboj ponownie.");
    error.name = "PayloadTooLarge";
    throw error;
  }

  const buffer = await image
    .resize({
      width: MAX_UPLOAD_DIMENSION,
      height: MAX_UPLOAD_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 92 })
    .toBuffer();

  return {
    buffer,
    contentType: "image/webp",
    extension: "webp",
  };
};

const getUploadErrorStatus = (error: unknown) => {
  if (error instanceof Error && error.name === "PayloadTooLarge") return 413;
  if (error instanceof Error && error.name === "BadImage") return 400;
  return 500;
};

const createSignedGraphics = async (graphics: LocalGraphicRow[]) => {
  return Promise.all(
    graphics.map(async (graphic) => {
      const path = getGraphicsStoragePath(graphic.url);

      if (!path) {
        return {
          ...graphic,
          signedUrl: null,
          signed_url: null,
          is_broken: false,
        };
      }

      const signedUrl = await getGraphicDisplayUrl(graphic.url);
      const thumbnailUrl = await getGraphicThumbnailDisplayUrl(graphic.url);

      return {
        ...graphic,
        signedUrl,
        signed_url: signedUrl,
        thumbnailUrl,
        thumbnail_url: thumbnailUrl,
        is_broken: !signedUrl,
      };
    })
  );
};

const createSignedTimelineGraphics = async (graphics: TimelineGraphicRow[]) => {
  return Promise.all(
    graphics.map(async (graphic) => {
      const signedUrl = await getGraphicDisplayUrl(graphic.url);
      const thumbnailUrl = await getGraphicThumbnailDisplayUrl(graphic.url);

      return {
        ...graphic,
        signedUrl,
        signed_url: signedUrl,
        thumbnailUrl,
        thumbnail_url: thumbnailUrl,
      };
    })
  );
};

const ensureGalleryAccess = async (requestUserId: string, targetUserId: string) => {
  if (requestUserId === targetUserId) return;

  const isAdmin = await getIsAdmin(requestUserId);
  if (!isAdmin) {
    const error = new Error("Brak uprawnien do galerii tego uzytkownika.");
    error.name = "Forbidden";
    throw error;
  }
};

galleryRouter.get("/gallery", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const filter = normalizeFilter(request.query.filter);
    const targetUserId =
      typeof request.query.userId === "string" && request.query.userId ? request.query.userId : user.id;
    const limit = Math.min(Math.max(Number(request.query.limit ?? 200), 1), 500);

    await ensureGalleryAccess(user.id, targetUserId);

    const graphics = await createSignedGraphics(
      await listLocalGraphicsByUser(targetUserId, { filter, limit })
    );

    response.json({
      ok: true,
      graphics,
    });
  } catch (error) {
    response.status(error instanceof Error && error.name === "Forbidden" ? 403 : 500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Nie udalo sie pobrac galerii.",
    });
  }
});

galleryRouter.get("/gallery/tool-images", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const limit = Math.min(Math.max(Number(request.query.limit ?? 24), 1), 60);

    const images = await Promise.all(
      (await listLocalToolGalleryGraphics(user.id, limit)).map(async (graphic: ToolGalleryGraphicRow) => {
        if (!graphic.url) return null;

        const displayUrl = await getGraphicDisplayUrl(graphic.url);
        const thumbnailUrl = await getGraphicThumbnailDisplayUrl(graphic.url);
        const url = displayUrl ?? (graphic.url.startsWith("http") ? graphic.url : null);

        if (!url) return null;

        return {
          id: graphic.id,
          url,
          thumbnailUrl: thumbnailUrl ?? url,
          thumbnail_url: thumbnailUrl ?? url,
          prompt: graphic.prompt ?? "",
        };
      })
    );

    response.json({
      ok: true,
      images: images.filter(Boolean),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Nie udalo sie pobrac grafik z galerii.",
    });
  }
});

galleryRouter.post("/gallery/save", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const dataUrl = typeof request.body?.dataUrl === "string" ? request.body.dataUrl : "";
    const prompt = typeof request.body?.prompt === "string" ? request.body.prompt : "";
    const style = typeof request.body?.style === "string" ? request.body.style : "realistic";
    const type = typeof request.body?.type === "string" ? request.body.type : "generated";
    const dimensions =
      typeof request.body?.dimensions === "string" && request.body.dimensions.trim().length > 0
        ? request.body.dimensions.trim()
        : null;

    if (!dataUrl.startsWith("data:image/")) {
      response.status(400).json({ ok: false, message: "Nieprawidlowy obraz do zapisu." });
      return;
    }

    const safeImage = await prepareSafeImageUpload(dataUrl);
    const contentType = safeImage.contentType;
    const extension = safeImage.extension;
    const fileName = `${user.id}/${randomUUID()}.${extension}`;
    const relativePath = `graphics/${fileName}`;
    const storagePath = await writeStorageFile(relativePath, safeImage.buffer, { contentType });
    const graphic = await createLocalGraphic({
      user_id: user.id,
      url: storagePath,
      prompt,
      style,
      type,
      dimensions,
    });

    await recordLocalGraphicHistoryEntry({
      graphic_id: graphic.id,
      user_id: user.id,
      prompt,
      style,
      type,
      dimensions,
      created_at: graphic.created_at,
    });

    const staleGraphics = await trimLocalSavedGraphics(user.id, MAX_SAVED_GRAPHICS);
    await Promise.all(staleGraphics.map((graphic) => deleteGraphicFile(graphic.url)));

    response.json({
      ok: true,
      fileName,
      trimmedCount: staleGraphics.length,
    });
  } catch (error) {
    response.status(getUploadErrorStatus(error)).json({
      ok: false,
      message: error instanceof Error ? error.message : "Nie udalo sie zapisac grafiki.",
    });
  }
});

galleryRouter.post("/gallery/reference-upload", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const dataUrl = typeof request.body?.dataUrl === "string" ? request.body.dataUrl : "";

    if (!dataUrl.startsWith("data:image/")) {
      response.status(400).json({ ok: false, message: "Nieprawidlowy obraz referencyjny." });
      return;
    }

    const safeImage = await prepareSafeImageUpload(dataUrl);
    const contentType = safeImage.contentType;
    const extension = safeImage.extension;
    const relativePath = `graphics/${user.id}/references/${randomUUID()}.${extension}`;
    const storagePath = await writeStorageFile(relativePath, safeImage.buffer, { contentType });

    response.json({
      ok: true,
      path: storagePath,
    });
  } catch (error) {
    response.status(getUploadErrorStatus(error)).json({
      ok: false,
      message: error instanceof Error ? error.message : "Nie udalo sie zapisac obrazu referencyjnego.",
    });
  }
});

galleryRouter.get("/gallery/:id/timeline", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const graphicId = String(request.params.id);
    const current = await getLocalGraphicById(graphicId);

    if (!current) {
      response.status(404).json({ ok: false, message: "Nie znaleziono grafiki." });
      return;
    }

    if (current.user_id) {
      await ensureGalleryAccess(user.id, current.user_id);
    }

    let currentId: string | null = graphicId;
    let rootId = graphicId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const node = await getLocalGraphicById(currentId);
      if (!node) break;

      rootId = node.id;
      currentId = node.parent_id;
    }

    const allGraphics: TimelineGraphicRow[] = [];
    const queue = [rootId];
    const seen = new Set<string>();

    const rootData = await getLocalGraphicById(rootId);
    if (rootData) {
      allGraphics.push(rootData as TimelineGraphicRow);
      seen.add(rootId);
    }

    const rootUserId = (rootData as TimelineGraphicRow | null)?.user_id ?? current.user_id ?? null;

    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const children = (await listLocalGraphicsByParentId(parentId, rootUserId)) as TimelineGraphicRow[];

      for (const child of children) {
        if (!seen.has(child.id)) {
          seen.add(child.id);
          allGraphics.push(child);
          queue.push(child.id);
        }
      }
    }

    allGraphics.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    response.json({ ok: true, graphics: await createSignedTimelineGraphics(allGraphics) });
  } catch (error) {
    response.status(error instanceof Error && error.name === "Forbidden" ? 403 : 500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Nie udalo sie pobrac historii edycji.",
    });
  }
});

galleryRouter.delete("/gallery/:id", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const graphicId = String(request.params.id || "");
    const existing = await getLocalGraphicByUserAndId(user.id, graphicId);

    if (!existing) {
      response.status(404).json({ ok: false, message: "Nie znaleziono grafiki." });
      return;
    }

    await deleteLocalGraphicsByIds([graphicId]);
    await deleteGraphicFile(existing.url);
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Nie udalo sie usunac grafiki.",
    });
  }
});

galleryRouter.post("/gallery/cleanup-broken", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const ids = Array.isArray(request.body?.ids)
      ? request.body.ids.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (ids.length === 0) {
      response.status(400).json({ ok: false, message: "Brak grafik do usuniecia." });
      return;
    }

    const existingRows = await listLocalGraphicsByIdsForUser(user.id, ids);
    await deleteLocalGraphicsByIds(existingRows.map((graphic) => graphic.id));
    await Promise.all(existingRows.map((graphic) => deleteGraphicFile(graphic.url)));

    response.json({ ok: true, deleted: existingRows.length });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Nie udalo sie wyczyscic galerii.",
    });
  }
});

galleryRouter.patch("/gallery/:id/public", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const graphicId = String(request.params.id || "");
    const isPublic = Boolean(request.body?.is_public);
    const data = await setLocalGraphicPublic(graphicId, user.id, isPublic);

    if (!data) {
      response.status(404).json({ ok: false, message: "Nie znaleziono grafiki." });
      return;
    }

    const [graphic] = await createSignedGraphics([data]);
    response.json({ ok: true, graphic });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Nie udalo sie zmienic widocznosci grafiki.",
    });
  }
});

galleryRouter.post("/gallery/:id/share", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const graphicId = String(request.params.id || "");
    const token = await ensureLocalGraphicShareToken(graphicId, user.id);

    if (!token) {
      response.status(404).json({ ok: false, message: "Nie znaleziono grafiki." });
      return;
    }

    response.json({ ok: true, public_token: token });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Nie udalo sie utworzyc linku.",
    });
  }
});
