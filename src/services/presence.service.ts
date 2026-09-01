import { SOCKET_EVENTS } from "@constants/socket.constants";
import { getRedisClient } from "@config/redis";
import type { Server, Socket } from "socket.io";

export interface OnlineUserPayload {
  id: number | string;
  name: string;
  email?: string;
  role?: string;
  profile_image?: string;
}

type PresenceEntry = {
  user: OnlineUserPayload;
  socketIds: Set<string>;
};

const PRESENCE_USERS_KEY = "presence:users";
const PRESENCE_WATCHERS_ROOM = "presence-watchers";
const PRESENCE_SOCKET_TTL_SEC = 120;
const presenceSocketKey = (userId: string | number) => `presence:sockets:${userId}`;

const onlineByUserId = new Map<string, PresenceEntry>();
let presenceIo: Server | null = null;

export function initPresenceIo(io: Server) {
  presenceIo = io;
}

function userKey(userId: number | string) {
  return String(userId);
}

function userRoom(userId: number | string) {
  return `user-${userId}`;
}

function toOnlineUser(user: Record<string, unknown>): OnlineUserPayload {
  return {
    id: user.id as number | string,
    name: String(user.name || user.email || "User"),
    email: user.email ? String(user.email) : undefined,
    role: user.role ? String(user.role) : undefined,
    profile_image: user.profile_image ? String(user.profile_image) : undefined,
  };
}

async function liveSocketIdsForUser(userId: number | string): Promise<Set<string>> {
  if (!presenceIo) return new Set();
  const sockets = await presenceIo.in(userRoom(userId)).fetchSockets();
  return new Set(sockets.map((s) => s.id));
}

async function reconcileRedisPresence(): Promise<OnlineUserPayload[] | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.hgetall(PRESENCE_USERS_KEY);
    const users: OnlineUserPayload[] = [];

    for (const [key, value] of Object.entries(raw)) {
      const liveIds = await liveSocketIdsForUser(key);

      if (liveIds.size === 0) {
        await redis.hdel(PRESENCE_USERS_KEY, key);
        await redis.del(presenceSocketKey(key));
        continue;
      }

      const storedIds = await redis.smembers(presenceSocketKey(key));
      for (const socketId of storedIds) {
        if (!liveIds.has(socketId)) {
          await redis.srem(presenceSocketKey(key), socketId);
        }
      }
      for (const socketId of liveIds) {
        await redis.sadd(presenceSocketKey(key), socketId);
      }
      await redis.expire(presenceSocketKey(key), PRESENCE_SOCKET_TTL_SEC);

      try {
        users.push(JSON.parse(value) as OnlineUserPayload);
      } catch {
        await redis.hdel(PRESENCE_USERS_KEY, key);
      }
    }

    return users.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return null;
  }
}

function reconcileMemoryPresence() {
  if (!presenceIo) return;

  for (const [key, entry] of onlineByUserId.entries()) {
    for (const socketId of [...entry.socketIds]) {
      if (!presenceIo.sockets.sockets.has(socketId)) {
        entry.socketIds.delete(socketId);
      }
    }
    if (entry.socketIds.size === 0) {
      onlineByUserId.delete(key);
    }
  }
}

export async function listOnlineUsers(): Promise<OnlineUserPayload[]> {
  const fromRedis = await reconcileRedisPresence();
  if (fromRedis) return fromRedis;

  reconcileMemoryPresence();
  return Array.from(onlineByUserId.values())
    .map((e) => e.user)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getOnlineCount(): Promise<number> {
  const users = await listOnlineUsers();
  return users.length;
}

function broadcastUpdate(io: Server, action: "join" | "leave", user: OnlineUserPayload, count: number) {
  io.to(PRESENCE_WATCHERS_ROOM).emit(SOCKET_EVENTS.PRESENCE_UPDATE, { action, user, count });
}

export async function sendPresenceSync(socket: Socket) {
  socket.join(PRESENCE_WATCHERS_ROOM);
  const users = await listOnlineUsers();
  socket.emit(SOCKET_EVENTS.PRESENCE_SYNC, {
    users,
    count: users.length,
  });
}

async function registerPresenceRedis(user: OnlineUserPayload, socketId: string) {
  const redis = getRedisClient();
  if (!redis) return { ok: false, isNew: false };
  const key = userKey(user.id);
  try {
    const wasOnline = await redis.hexists(PRESENCE_USERS_KEY, key);
    await redis.hset(PRESENCE_USERS_KEY, key, JSON.stringify(user));
    await redis.sadd(presenceSocketKey(key), socketId);
    await redis.expire(presenceSocketKey(key), PRESENCE_SOCKET_TTL_SEC);
    const liveIds = await liveSocketIdsForUser(user.id);
    return { ok: true, isNew: !wasOnline && liveIds.size === 1 };
  } catch {
    return { ok: false, isNew: false };
  }
}

async function unregisterPresenceRedis(userId: number | string, socketId: string) {
  const redis = getRedisClient();
  if (!redis) return null;
  const key = userKey(userId);
  try {
    await redis.srem(presenceSocketKey(key), socketId);
    const liveIds = await liveSocketIdsForUser(userId);
    if (liveIds.size === 0) {
      await redis.hdel(PRESENCE_USERS_KEY, key);
      await redis.del(presenceSocketKey(key));
      return true;
    }
    await redis.expire(presenceSocketKey(key), PRESENCE_SOCKET_TTL_SEC);
    return false;
  } catch {
    return null;
  }
}

export async function touchPresence(socket: Socket) {
  const rawUser = (socket as any).user;
  if (rawUser?.id == null) return;

  const user = toOnlineUser(rawUser);
  const key = userKey(rawUser.id);
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.hset(PRESENCE_USERS_KEY, key, JSON.stringify(user));
      await redis.sadd(presenceSocketKey(key), socket.id);
      await redis.expire(presenceSocketKey(key), PRESENCE_SOCKET_TTL_SEC);
    } catch {
      /* ignore */
    }
    return;
  }

  const entry = onlineByUserId.get(key);
  if (entry) entry.user = user;
}

export async function registerPresence(io: Server, socket: Socket) {
  const rawUser = (socket as any).user;
  if (rawUser?.id == null) return;

  const key = userKey(rawUser.id);
  const user = toOnlineUser(rawUser);
  const redisResult = await registerPresenceRedis(user, socket.id);

  if (!redisResult.ok) {
    let entry = onlineByUserId.get(key);
    const isNew = !entry;
    if (!entry) {
      entry = { user, socketIds: new Set() };
      onlineByUserId.set(key, entry);
    } else {
      entry.user = user;
    }
    entry.socketIds.add(socket.id);
    if (isNew) {
      broadcastUpdate(io, "join", user, onlineByUserId.size);
    }
  } else if (redisResult.isNew) {
    const count = (await listOnlineUsers()).length;
    broadcastUpdate(io, "join", user, count);
  }

  await sendPresenceSync(socket);
}

export async function unregisterPresence(io: Server, socket: Socket) {
  const rawUser = (socket as any).user;
  if (rawUser?.id == null) return;

  const key = userKey(rawUser.id);
  const redisLeft = await unregisterPresenceRedis(rawUser.id, socket.id);

  if (redisLeft === true) {
    const entry = onlineByUserId.get(key);
    const user = entry?.user || toOnlineUser(rawUser);
    const count = (await listOnlineUsers()).length;
    broadcastUpdate(io, "leave", user, count);
    onlineByUserId.delete(key);
    return;
  }

  if (redisLeft === false) return;

  const entry = onlineByUserId.get(key);
  if (!entry) return;

  entry.socketIds.delete(socket.id);
  if (entry.socketIds.size > 0) return;

  onlineByUserId.delete(key);
  const count = onlineByUserId.size;
  broadcastUpdate(io, "leave", entry.user, count);
}
