import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { normalizeRelativePath } from "./lib/localFiles.js";
import { serveStorageFile } from "./lib/storage.js";
import { apiRouter } from "./routes/index.js";

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.set("etag", false);

  app.use(helmet());
  app.use(
    cors({
      origin: [env.appUrl, env.frontendUrl, env.adminUrl],
      credentials: true
    })
  );
  app.use("/billing/payment-webhook", express.raw({ type: "*/*" }));
  app.use("/billing/payu-webhook", express.raw({ type: "*/*" }));
  app.use("/billing/tpay-webhook", express.raw({ type: "*/*" }));
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
  app.get(/^\/files\/.*$/, async (request, response) => {
    try {
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      response.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
      const relativePath = normalizeRelativePath(request.path.replace(/^\/files\/?/, ""));
      const served = await serveStorageFile(relativePath, response);

      if (!served) {
        response.status(404).json({
          ok: false,
          message: "Nie znaleziono pliku.",
        });
      }
    } catch {
      response.status(404).json({
        ok: false,
        message: "Nie znaleziono pliku.",
      });
    }
  });

  app.use(apiRouter);

  app.use((request, response) => {
    response.status(404).json({
      ok: false,
      message: "Route not found on VPS API.",
      path: request.originalUrl
    });
  });

  return app;
};
