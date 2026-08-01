import "dotenv/config";
import mongoose from "mongoose";

let isConnected = false;

export async function connectDatabase(): Promise<typeof mongoose> {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    `mongodb://${process.env.MONGO_HOST || "127.0.0.1"}:${process.env.MONGO_PORT || "27017"}/${process.env.MONGO_DATABASE || "soms"}`;

  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  mongoose.set("strictQuery", false);
  mongoose.set("bufferCommands", false);

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 30000,
  });

  isConnected = true;
  console.log("✅ MongoDB connected successfully!");
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}

export default mongoose;
