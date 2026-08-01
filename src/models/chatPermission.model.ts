import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const ChatPermissionSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    senderId: { type: Number },
    receiverId: { type: Number },
  },
  collectionOptions("chat_permissions"),
);

applyBasePlugins(ChatPermissionSchema, { collection: "chat_permissions", paranoid: false });

const ChatPermission =
  mongoose.models.ChatPermission ?? mongoose.model("ChatPermission", ChatPermissionSchema);
export default ChatPermission;
