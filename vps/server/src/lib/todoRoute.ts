import type { RequestHandler } from "express";

type TodoRouteOptions = {
  scope: string;
  action: string;
};

export const todoRoute = ({ scope, action }: TodoRouteOptions): RequestHandler => {
  return (request, response) => {
    response.status(501).json({
      ok: false,
      message: "Endpoint is prepared for VPS migration but is not implemented yet.",
      scope,
      action,
      method: request.method,
      path: request.originalUrl
    });
  };
};
