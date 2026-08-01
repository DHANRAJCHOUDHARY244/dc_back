import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const socketAuthenticate = (
  socket: Socket,
  next: (err?: Error) => void
) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.query?.token ||
    socket.handshake.headers?.token;

  try {
    if (!token) return next(new Error("Unauthorized"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    (socket as any).user = decoded;
    
    return next();
  } catch (err) {
    return next(new Error("Invalid token"));
  }
};
