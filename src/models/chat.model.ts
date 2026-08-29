import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const MemberMetaSchema = new Schema(
  {
    userId: { type: Number, required: true },
    joinedAt: { type: Date, default: Date.now },
    muted: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
  },
  { _id: false },
);

const ChatSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String },
    type: { type: String, required: true, enum: ["group", "direct"] },
    members: { type: [Number], required: true, index: true },
    avatar: { type: String, default: null },
    createdBy: { type: Number, default: null, index: true },
    admins: { type: [Number], default: () => [] },
    memberMeta: { type: [MemberMetaSchema], default: () => [] },
  },
  collectionOptions("chats"),
);

applyBasePlugins(ChatSchema, { collection: "chats", paranoid: false });

ChatSchema.index({ members: 1, updated_at: -1 });

const Chat = mongoose.models.Chat ?? mongoose.model("Chat", ChatSchema);
export default Chat;
