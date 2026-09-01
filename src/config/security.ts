import type { CorsOptions } from "cors";
import { isOriginAllowed, parseAllowedOrigins } from "@config/origins";

export function getCorsOptions(): CorsOptions {
  const allowedOrigins = parseAllowedOrigins();

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isOriginAllowed(origin, allowedOrigins)) {
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
