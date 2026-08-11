import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

export const MESSAGE_TYPES = ["text", "image", "video", "audio", "document", "mixed"] as const;

const MessageAttachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    mime_type: { type: String, default: "" },
    original_name: { type: String, default: "" },
    size_bytes: { type: Number, default: 0 },
    kind: {
      type: String,
      enum: ["image", "video", "audio", "document"],
      default: "document",
    },
    thumbnail_url: { type: String, default: "" },
    duration_seconds: { type: Number, default: null },
  },
  { _id: false },
);

const MessageSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    chatId: { type: Number, required: true, index: true },
    senderId: { type: Number, required: true, index: true },
    content: { type: String, default: "" },
    messageType: {
      type: String,
      enum: MESSAGE_TYPES,
      default: "text",
      index: true,
    },
    attachments: { type: [MessageAttachmentSchema], default: () => [] },
  },
  collectionOptions("messages"),
);

MessageSchema.virtual("sender", {
  ref: "User",
  localField: "senderId",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(MessageSchema, { collection: "messages", paranoid: false });

const Message = mongoose.models.Message ?? mongoose.model("Message", MessageSchema);
export default Message;
