import type { Request } from "express";

/** Prefer Authorization Bearer; fall back to legacy token header/body/query. */
export function extractAuthToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }

  const legacy =
    (typeof req.body?.token === "string" && req.body.token) ||
    (typeof req.query?.token === "string" && req.query.token) ||
    (typeof req.headers.token === "string" && req.headers.token);

  return legacy || undefined;
}
