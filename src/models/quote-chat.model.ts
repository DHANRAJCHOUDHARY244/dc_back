import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const QuoteChatSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    quote_id: { type: Number, required: true },
    sender_id: { type: Number, required: true },
    content: { type: String, required: true },
  },
  collectionOptions("quote_chats"),
);

QuoteChatSchema.virtual("sender", {
  ref: "User",
  localField: "sender_id",
  foreignField: "id",
  justOne: true,
});

QuoteChatSchema.virtual("quote", {
  ref: "Quote",
  localField: "quote_id",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(QuoteChatSchema, { collection: "quote_chats", paranoid: true });

const QuoteChat = mongoose.models.QuoteChat ?? mongoose.model("QuoteChat", QuoteChatSchema);
export default QuoteChat;
