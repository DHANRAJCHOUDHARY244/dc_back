function normalizeOrigin(value?: string): string {
  return String(value || "").trim().replace(/\/$/, "");
}

/** Allowed browser origins from env (FRONTEND_URL, FRONT_URL, BASE_URL, CORS_ORIGINS). */
export function parseAllowedOrigins(): string[] {
  const raw: string[] = [];

  const add = (value?: string) => {
    const normalized = normalizeOrigin(value);
    if (normalized) raw.push(normalized);
  };

  add(process.env.FRONTEND_URL);
  add(process.env.FRONT_URL);
  add(process.env.BASE_URL);

  if (process.env.CORS_ORIGINS) {
    for (const part of process.env.CORS_ORIGINS.split(",")) {
      add(part);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    raw.push(
      "http://localhost:3001",
      "http://localhost:5173",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:5173",
    );
  }

  return [...new Set(raw)];
}

export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.includes(normalized)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized);
}
