import type { CorsOptions } from "cors";

function parseOrigins(): string[] {
  const raw = [process.env.FRONTEND_URL, process.env.FRONT_URL, process.env.BASE_URL]
    .filter(Boolean)
    .map((url) => String(url).trim().replace(/\/$/, ""));

  if (process.env.NODE_ENV !== "production") {
    raw.push("http://localhost:3001", "http://localhost:5173", "http://127.0.0.1:3001", "http://127.0.0.1:5173");
  }

  return [...new Set(raw)];
}

export function getCorsOptions(): CorsOptions {
  const allowedOrigins = parseOrigins();

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = origin.replace(/\/$/, "");
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized);
      if (allowedOrigins.includes(normalized) || isLocalhost) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  };
}

export function validateSecurityEnv() {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    throw new Error("JWT_SECRET must be set");
  }
  if (jwtSecret.length < 32) {
    console.warn("⚠️  JWT_SECRET should be at least 32 characters — generate a new random secret for production");
  }
  if (jwtSecret === "change-me" || jwtSecret === "dfgkhlkjgcytuvyibunm") {
    console.warn("⚠️  JWT_SECRET is using a weak/default value — rotate it immediately");
  }
}
