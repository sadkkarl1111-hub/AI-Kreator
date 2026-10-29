import type { RequestHandler } from "express";
import { verifyLocalAccessToken } from "../lib/localAuth.js";
import { getLocalAuthUser } from "../lib/localUserData.js";
import type { AuthenticatedUser } from "../types/auth.js";

declare module "express-serve-static-core" {
  interface Request {
    authUser?: AuthenticatedUser;
  }
}

const getBearerToken = (authorizationHeader?: string) => {
  if (!authorizationHeader) return null;
  const [type, token] = authorizationHeader.split(" ");

  if (type?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
};

export const requireAuthenticatedUser: RequestHandler = async (request, response, next) => {
  try {
    const accessToken = getBearerToken(request.header("authorization"));

    if (!accessToken) {
      response.status(401).json({
        ok: false,
        message: "Missing Bearer token."
      });
      return;
    }

    const localPayload = verifyLocalAccessToken(accessToken);
    if (!localPayload) {
      response.status(401).json({
        ok: false,
        message: "Invalid or expired session token."
      });
      return;
    }

    const localUser = await getLocalAuthUser(localPayload.sub).catch(() => null);
    if (!localUser?.user_id) {
      response.status(401).json({
        ok: false,
        message: "Invalid or expired session token."
      });
      return;
    }

    if (!localUser.email_confirmed_at) {
      response.status(403).json({
        ok: false,
        message: "Email not confirmed."
      });
      return;
    }

    request.authUser = {
      id: localUser.user_id,
      email: localUser.email ?? localPayload.email ?? null
    };

    next();
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Authentication middleware failed."
    });
  }
};
