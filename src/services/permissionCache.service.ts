import type { MenuItem } from "@constants/common.interface";
import { cacheDel, cacheDelByPattern, cacheGetJson, cacheSetJson } from "@services/redisCache.service";

const TTL_SECONDS = 5 * 60;
const REDIS_PREFIX = "permissions:tree:";

type CacheEntry = { tree: MenuItem[]; expiresAt: number };

const memoryCache = new Map<number, CacheEntry>();

function getMemory(roleId: number): MenuItem[] | null {
  const entry = memoryCache.get(roleId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(roleId);
    return null;
  }
  return entry.tree;
}

function setMemory(roleId: number, tree: MenuItem[]) {
  memoryCache.set(roleId, { tree, expiresAt: Date.now() + TTL_SECONDS * 1000 });
}

export async function getCachedPermissionTree(roleId: number): Promise<MenuItem[] | null> {
  const mem = getMemory(roleId);
  if (mem) return mem;

  const fromRedis = await cacheGetJson<MenuItem[]>(`${REDIS_PREFIX}${roleId}`);
  if (fromRedis) {
    setMemory(roleId, fromRedis);
    return fromRedis;
  }
  return null;
}

export async function setCachedPermissionTree(roleId: number, tree: MenuItem[]): Promise<void> {
  setMemory(roleId, tree);
  await cacheSetJson(`${REDIS_PREFIX}${roleId}`, tree, TTL_SECONDS);
}

export function invalidatePermissionCache(roleId?: number): void {
  if (roleId != null) {
    memoryCache.delete(roleId);
    void cacheDel(`${REDIS_PREFIX}${roleId}`);
    return;
  }
  memoryCache.clear();
  void cacheDelByPattern(`${REDIS_PREFIX}*`);
}
