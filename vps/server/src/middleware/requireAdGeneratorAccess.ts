import type { RequestHandler } from 'express';
// Prompts are now free for every signed-in account. Durable IP/account quotas are enforced by the routes.
export function createAdGeneratorAccess(): RequestHandler {
  return async (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    if (!request.authUser) { response.status(401).json({ error: 'Wymagane logowanie.' }); return; }
    next();
  };
}
export const requireAdGeneratorAccess = createAdGeneratorAccess();
