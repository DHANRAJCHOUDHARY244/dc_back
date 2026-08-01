import { SocketDataInterface } from "@constants/socket.constants";
import { Server } from "socket.io";

let io: Server;

export const SocketService = {
  init(server: Server) {
    io = server;
  },
  getIO(): Server {
    if (!io) throw new Error("Socket.IO not initialized");
    return io;
  },
  emit(event: string, data: SocketDataInterface|any) {
    io?.emit(event, {...data,time: new Date().toISOString()});
  },
  /** Emit to a specific room only */
  emitToRoom(room: string, event: string, data: any) {
    io?.to(room).emit(event, { ...data, time: new Date().toISOString() });
  },
};
