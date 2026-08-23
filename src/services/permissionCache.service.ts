import type { MenuItem } from "@constants/common.interface";

const TTL_MS = 5 * 60 * 1000;

type CacheEntry = { tree: MenuItem[]; expiresAt: number };

const cache = new Map<number, CacheEntry>();

export function getCachedPermissionTree(roleId: number): MenuItem[] | null {
  const entry = cache.get(roleId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(roleId);
    return null;
  }
  return entry.tree;
}

export function setCachedPermissionTree(roleId: number, tree: MenuItem[]): void {
  cache.set(roleId, { tree, expiresAt: Date.now() + TTL_MS });
}

export function invalidatePermissionCache(roleId?: number): void {
  if (roleId != null) {
    cache.delete(roleId);
    return;
  }
  cache.clear();
}
