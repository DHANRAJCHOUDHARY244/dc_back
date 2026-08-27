import "dotenv/config";
import mongoose from "mongoose";

let isConnected = false;

function resolveMongoUri() {
  return (
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    `mongodb://${process.env.MONGO_HOST || "127.0.0.1"}:${process.env.MONGO_PORT || "27017"}/${process.env.MONGO_DATABASE || "soms"}`
  );
}

function maskUri(uri: string) {
  return uri.replace(/\/\/([^:/@]+):([^@]+)@/, "//$1:***@");
}

export async function connectDatabase(): Promise<typeof mongoose> {
  const uri = resolveMongoUri();

  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  mongoose.set("strictQuery", false);
  // Fail fast instead of queuing queries while disconnected (avoids multi-second hangs).
  mongoose.set("bufferCommands", false);

  const isLocal =
    /127\.0\.0\.1|localhost/.test(uri) || process.env.MONGO_LOCAL === "true";

  await mongoose.connect(uri, {
    // Keep a few warm sockets so first queries after idle are fast.
    maxPoolSize: Number(process.env.MONGO_MAX_POOL || (isLocal ? 20 : 15)),
    minPoolSize: Number(process.env.MONGO_MIN_POOL || (isLocal ? 2 : 3)),
    maxIdleTimeMS: 60_000,
    // Fail sooner than default when remote DB is unreachable.
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_MS || (isLocal ? 5_000 : 12_000)),
    connectTimeoutMS: Number(process.env.MONGO_CONNECT_MS || 10_000),
    socketTimeoutMS: Number(process.env.MONGO_SOCKET_MS || 45_000),
    heartbeatFrequencyMS: 10_000,
    // Reduce chatter on remote links.
    compressors: isLocal ? undefined : (["zlib"] as any),
  });

  isConnected = true;
  console.log(`✅ MongoDB connected successfully! (${maskUri(uri)})`);
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}

export default mongoose;
