import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const ChatSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String },
    type: { type: String, required: true, enum: ["group", "direct"] },
    members: { type: [Number], required: true },
  },
  collectionOptions("chats"),
);

applyBasePlugins(ChatSchema, { collection: "chats", paranoid: false });

const Chat = mongoose.models.Chat ?? mongoose.model("Chat", ChatSchema);
export default Chat;
