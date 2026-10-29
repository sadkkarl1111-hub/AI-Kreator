import type { RequestHandler } from "express";
import { hasLocalUserRole } from "../lib/localUserData.js";

export const requireAdminUser: RequestHandler = async (request, response, next) => {
  try {
    if (!request.authUser) {
      response.status(401).json({ error: "Wymagane logowanie." });
      return;
    }
    if (!(await hasLocalUserRole(request.authUser.id, "admin"))) {
      response.status(403).json({ error: "Dostępne wkrótce. Obecnie dostęp tylko dla administratora." });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
