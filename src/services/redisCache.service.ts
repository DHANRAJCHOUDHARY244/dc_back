import { getRedisClient } from "@config/redis";

const memoryStore = new Map<string, { value: string; expiresAt: number }>();

function memoryGet(key: string): string | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds?: number) {
  memoryStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0,
  });
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  const raw = memoryGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const payload = JSON.stringify(value);
  const redis = getRedisClient();
  if (redis) {
    try {
      if (ttlSeconds) await redis.set(key, payload, "EX", ttlSeconds);
      else await redis.set(key, payload);
      return;
    } catch {
      // fall through to memory
    }
  }
  memorySet(key, payload, ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // ignore
    }
  }
  memoryStore.delete(key);
}

export async function cacheDelByPattern(pattern: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      let cursor = "0";
      do {
        const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = next;
        if (keys.length) await redis.del(...keys);
      } while (cursor !== "0");
    } catch {
      // ignore
    }
  }
  const prefix = pattern.replace(/\*/g, "");
  for (const key of [...memoryStore.keys()]) {
    if (key.startsWith(prefix)) memoryStore.delete(key);
  }
}

export async function cacheIncr(key: string, windowSeconds: number): Promise<number> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);
      return count;
    } catch {
      // fall through
    }
  }
  const memKey = `__incr:${key}`;
  const current = Number(memoryGet(memKey) || "0") + 1;
  memorySet(memKey, String(current), windowSeconds);
  return current;
}
