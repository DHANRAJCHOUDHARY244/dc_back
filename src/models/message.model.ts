import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const MessageSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    chatId: { type: Number, required: true },
    senderId: { type: Number, required: true },
    content: { type: String, required: true },
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
