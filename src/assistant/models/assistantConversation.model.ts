import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const AssistantConversationSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    user_id: { type: Number, required: true, index: true },
    title: { type: String, default: "New chat" },
    messages: jsonArray,
    last_message_at: { type: Date, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  collectionOptions("assistant_conversations"),
);

applyBasePlugins(AssistantConversationSchema, {
  collection: "assistant_conversations",
  paranoid: true,
});

const AssistantConversation =
  mongoose.models.AssistantConversation ??
  mongoose.model("AssistantConversation", AssistantConversationSchema);
export default AssistantConversation;
