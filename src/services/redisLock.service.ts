import { getRedisClient, isRedisReady } from "@config/redis";

const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

/**
 * Run `fn` only if this process acquires a Redis lock.
 * Returns null when another worker already holds the lock.
 * Without Redis, always runs `fn` (single-instance fallback).
 */
export async function tryWithRedisLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis || !isRedisReady()) return fn();

  const lockKey = `lock:${key}`;
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const acquired = await redis.set(lockKey, token, "PX", ttlMs, "NX");
  if (acquired !== "OK") return null;

  try {
    return await fn();
  } finally {
    await redis.eval(RELEASE_SCRIPT, 1, lockKey, token).catch(() => undefined);
  }
}

/**
 * Serialize work across PM2 workers for the same key.
 * Waiters poll until the lock is free, then run `fn`.
 */
export async function withRedisLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const redis = getRedisClient();
  if (!redis || !isRedisReady()) return fn();

  const lockKey = `lock:${key}`;
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  for (let attempt = 0; attempt < 60; attempt++) {
    const acquired = await redis.set(lockKey, token, "PX", ttlMs, "NX");
    if (acquired === "OK") {
      try {
        return await fn();
      } finally {
        await redis.eval(RELEASE_SCRIPT, 1, lockKey, token).catch(() => undefined);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50 + attempt * 15));
  }

  return fn();
}
