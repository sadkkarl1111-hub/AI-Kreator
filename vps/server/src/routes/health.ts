import { Router } from "express";
import { env } from "../config/env.js";

export const healthRouter = Router();

healthRouter.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: "kreator-ai-vps-api",
    nodeEnv: env.nodeEnv,
    appUrl: env.appUrl,
    apiUrl: env.apiUrl
  });
});
