import { SOCKET_EVENTS } from "@constants/socket.constants";
import { roleRoom } from "@services/permissionNotify.service";
import { SocketService } from "@services/socket.service";
import { Server, Socket } from "socket.io";
import { socketAuthenticate } from "src/middleware/socketAuth.middleware";

export const setupSocket = (httpServer: any) => {
  const io = new Server(httpServer);
  io.use(socketAuthenticate);
  SocketService.init(io);

  io.on(SOCKET_EVENTS.CONNECTION, (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`✅ Socket connected: ${user?.email || socket.id}`);

    /* Join personal + role rooms so permission / CRM pushes reach this user live */
    if (user?.id != null) {
      socket.join(`user-${user.id}`);
    }
    if (user?.role_id != null) {
      socket.join(roleRoom(user.role_id));
    }

    socket.emit(SOCKET_EVENTS.USER_NOTIFICATION + `${user?.id}`, {
      time: new Date().toISOString(),
      ...user,
      message: `Socket Connected id: ${socket.id}`,
      type: SOCKET_EVENTS.CONNECTION,
      task_type: SOCKET_EVENTS.HANDSHAKE_SUCCESS,
    });

    /* ── Quote Chat Rooms ── */
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
      console.log(`❌ Disconnected: ${socket.id}`);
    });
  });
  return io;
};
