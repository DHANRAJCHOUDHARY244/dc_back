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

const MentionSchema = new Schema(
  {
    userId: { type: Number, required: true },
    name: { type: String, required: true },
  },
  { _id: false },
);

const ReactionSchema = new Schema(
  {
    emoji: { type: String, required: true },
    userId: { type: Number, required: true },
  },
  { _id: false },
);

const LinkPreviewSchema = new Schema(
  {
    url: { type: String, required: true },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
  },
  { _id: false },
);

const ForwardedFromSchema = new Schema(
  {
    chatId: { type: Number, default: null },
    messageId: { type: Number, default: null },
    senderName: { type: String, default: "" },
    content: { type: String, default: "" },
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
    replyToId: { type: Number, default: null, index: true },
    mentions: { type: [MentionSchema], default: () => [] },
    reactions: { type: [ReactionSchema], default: () => [] },
    readBy: { type: [Number], default: () => [] },
    systemType: {
      type: String,
      enum: [
        "member_joined",
        "member_left",
        "member_removed",
        "group_renamed",
        "admin_promoted",
        null,
      ],
      default: null,
    },
    systemMeta: { type: Schema.Types.Mixed, default: null },
    editedAt: { type: Date, default: null },
    isPinned: { type: Boolean, default: false, index: true },
    pinnedAt: { type: Date, default: null },
    pinnedBy: { type: Number, default: null },
    starredBy: { type: [Number], default: () => [] },
    forwardedFrom: { type: ForwardedFromSchema, default: null },
    linkPreviews: { type: [LinkPreviewSchema], default: () => [] },
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

MessageSchema.index({ chatId: 1, id: -1 });
MessageSchema.index({ chatId: 1, senderId: 1, id: -1 });
MessageSchema.index({ chatId: 1, isPinned: 1, id: -1 });

const Message = mongoose.models.Message ?? mongoose.model("Message", MessageSchema);
export default Message;
