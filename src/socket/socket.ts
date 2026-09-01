import { SOCKET_EVENTS } from "@constants/socket.constants";
import { roleRoom } from "@services/permissionNotify.service";
import {
  initPresenceIo,
  registerPresence,
  sendPresenceSync,
  touchPresence,
  unregisterPresence,
} from "@services/presence.service";
import { SocketService } from "@services/socket.service";
import { getRedisPubSubClients } from "@config/redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server, Socket } from "socket.io";
import { socketAuthenticate } from "src/middleware/socketAuth.middleware";
import { attachChatSocketHandlers } from "./chat.socket";
import logger from "@utils/pino";

function parseSocketOrigins(): string[] | boolean {
  const raw = [process.env.FRONTEND_URL, process.env.FRONT_URL]
    .filter(Boolean)
    .map((url) => String(url).trim().replace(/\/$/, ""));
  if (process.env.NODE_ENV !== "production") {
    raw.push("http://localhost:3001", "http://localhost:5173");
  }
  const origins = [...new Set(raw)];
  return origins.length ? origins : false;
}

export async function setupSocket(httpServer: any) {
  const io = new Server(httpServer, {
    cors: { origin: parseSocketOrigins(), credentials: true },
  });

  const pubSub = getRedisPubSubClients();
  if (pubSub) {
    io.adapter(createAdapter(pubSub.pubClient, pubSub.subClient));
    logger.warn("Socket.IO Redis adapter enabled");
  }

  io.use(socketAuthenticate);
  SocketService.init(io);
  initPresenceIo(io);

  io.on(SOCKET_EVENTS.CONNECTION, (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`✅ Socket connected: ${user?.email || socket.id}`);

    attachChatSocketHandlers(socket);

    if (user?.id != null) {
      socket.join(`user-${user.id}`);
    }
    if (user?.role_id != null) {
      socket.join(roleRoom(user.role_id));
    }

    void registerPresence(io, socket);

    socket.on(SOCKET_EVENTS.PRESENCE_REQUEST, () => {
      void sendPresenceSync(socket);
    });

    socket.on(SOCKET_EVENTS.PRESENCE_HEARTBEAT, () => {
      void touchPresence(socket);
    });

    socket.emit(SOCKET_EVENTS.HANDSHAKE_SUCCESS, {
      time: new Date().toISOString(),
      userId: user?.id,
      socketId: socket.id,
    });

    socket.on(SOCKET_EVENTS.QUOTE_CHAT_JOIN, (quoteId: number | string) => {
      const room = `quote-chat-${quoteId}`;
      socket.join(room);
      console.log(`📝 ${user?.name || socket.id} joined ${room}`);
    });

    socket.on(SOCKET_EVENTS.QUOTE_CHAT_LEAVE, (quoteId: number | string) => {
      const room = `quote-chat-${quoteId}`;
      socket.leave(room);
      console.log(`📝 ${user?.name || socket.id} left ${room}`);
    });

    socket.on(SOCKET_EVENTS.QUOTE_CHAT_TYPING, (quoteId: number | string) => {
      const room = `quote-chat-${quoteId}`;
      socket.to(room).emit(SOCKET_EVENTS.QUOTE_CHAT_TYPING, {
        userId: user?.id,
        name: user?.name,
      });
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      void unregisterPresence(io, socket);
      console.log(`❌ Disconnected: ${socket.id}`);
    });
  });

  return io;
}
