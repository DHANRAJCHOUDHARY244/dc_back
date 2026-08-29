import { SOCKET_EVENTS } from "@constants/socket.constants";
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

export function listOnlineUsers(): OnlineUserPayload[] {
  return Array.from(onlineByUserId.values())
    .map((e) => e.user)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getOnlineCount(): number {
  return onlineByUserId.size;
}

function broadcastUpdate(io: Server, action: "join" | "leave", user: OnlineUserPayload) {
  io.emit(SOCKET_EVENTS.PRESENCE_UPDATE, { action, user, count: onlineByUserId.size });
}

export function sendPresenceSync(socket: Socket) {
  socket.emit(SOCKET_EVENTS.PRESENCE_SYNC, {
    users: listOnlineUsers(),
    count: onlineByUserId.size,
  });
}

export function registerPresence(io: Server, socket: Socket) {
  const rawUser = (socket as any).user;
  if (rawUser?.id == null) return;

  const key = userKey(rawUser.id);
  let entry = onlineByUserId.get(key);

  if (!entry) {
    entry = {
      user: toOnlineUser(rawUser),
      socketIds: new Set(),
    };
    onlineByUserId.set(key, entry);
    broadcastUpdate(io, "join", entry.user);
  } else {
    entry.user = toOnlineUser(rawUser);
  }

  entry.socketIds.add(socket.id);
  sendPresenceSync(socket);
}

export function unregisterPresence(io: Server, socket: Socket) {
  const rawUser = (socket as any).user;
  if (rawUser?.id == null) return;

  const key = userKey(rawUser.id);
  const entry = onlineByUserId.get(key);
  if (!entry) return;

  entry.socketIds.delete(socket.id);
  if (entry.socketIds.size > 0) return;

  onlineByUserId.delete(key);
  broadcastUpdate(io, "leave", entry.user);
}
