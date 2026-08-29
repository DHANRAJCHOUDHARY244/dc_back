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
const presenceSocketKey = (userId: string | number) => `presence:sockets:${userId}`;

const onlineByUserId = new Map<string, PresenceEntry>();

function userKey(userId: number | string) {
  return String(userId);
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

async function listOnlineUsersFromRedis(): Promise<OnlineUserPayload[] | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const raw = await redis.hgetall(PRESENCE_USERS_KEY);
    const users = Object.values(raw)
      .map((v) => {
        try {
          return JSON.parse(v) as OnlineUserPayload;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as OnlineUserPayload[];
    return users.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return null;
  }
}

export async function listOnlineUsers(): Promise<OnlineUserPayload[]> {
  const fromRedis = await listOnlineUsersFromRedis();
  if (fromRedis) return fromRedis;

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
    await redis.hset(PRESENCE_USERS_KEY, key, JSON.stringify(user));
    await redis.sadd(presenceSocketKey(key), socketId);
    const count = await redis.scard(presenceSocketKey(key));
    return { ok: true, isNew: count === 1 };
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
    const remaining = await redis.scard(presenceSocketKey(key));
    if (remaining === 0) {
      await redis.hdel(PRESENCE_USERS_KEY, key);
      await redis.del(presenceSocketKey(key));
      return true;
    }
    return false;
  } catch {
    return null;
  }
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
    return;
  }

  const entry = onlineByUserId.get(key);
  if (!entry) return;

  entry.socketIds.delete(socket.id);
  if (entry.socketIds.size > 0) return;

  onlineByUserId.delete(key);
  const count = onlineByUserId.size;
  broadcastUpdate(io, "leave", entry.user, count);
}
