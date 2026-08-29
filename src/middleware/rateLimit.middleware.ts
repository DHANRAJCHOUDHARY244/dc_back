import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@constants/common.interface";
import { ReE } from "@services/generalHelper.service";
import { SERVER_ERROR_CODE } from "@constants/serverCode";
import { cacheIncr } from "@services/redisCache.service";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientKey(req: AuthenticatedRequest) {
  const userId = req.user?.id;
  if (userId != null) return `user:${userId}`;
  return `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
}

function memoryRateLimit(
  key: string,
  windowMs: number,
  max: number,
  res: Response,
  next: NextFunction,
) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return ReE(res, SERVER_ERROR_CODE, "Too many requests. Please slow down.");
  }
  return next();
}

export function rateLimit(options: { windowMs?: number; max?: number; prefix?: string } = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 120;
  const prefix = options.prefix ?? "ratelimit";

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const key = `${prefix}:${clientKey(req)}`;
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

    try {
      const count = await cacheIncr(key, windowSeconds);
      if (count > max) {
        return ReE(res, SERVER_ERROR_CODE, "Too many requests. Please slow down.");
      }
      return next();
    } catch {
      return memoryRateLimit(key, windowMs, max, res, next);
    }
  };
}

export const chatMessageRateLimit = rateLimit({ windowMs: 60_000, max: 60, prefix: "chat:msg" });
export const chatSearchRateLimit = rateLimit({ windowMs: 60_000, max: 30, prefix: "chat:search" });
export const chatCreateRateLimit = rateLimit({ windowMs: 60_000, max: 20, prefix: "chat:create" });
export const chatListRateLimit = rateLimit({ windowMs: 60_000, max: 60, prefix: "chat:list" });
