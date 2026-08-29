import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const ChatReadStateSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    chatId: { type: Number, required: true, index: true },
    userId: { type: Number, required: true, index: true },
    lastReadMessageId: { type: Number, default: null },
    lastReadAt: { type: Date, default: null },
  },
  collectionOptions("chat_read_states"),
);

ChatReadStateSchema.index({ chatId: 1, userId: 1 }, { unique: true });

applyBasePlugins(ChatReadStateSchema, { collection: "chat_read_states", paranoid: false });

const ChatReadState =
  mongoose.models.ChatReadState ?? mongoose.model("ChatReadState", ChatReadStateSchema);
export default ChatReadState;
