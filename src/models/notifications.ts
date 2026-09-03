import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const NotificationSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    route: { type: String },
    userId: { type: Number, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    meta_information: { type: Schema.Types.Mixed, default: () => ({ type: "", link: "" }) },
    /** Top-level copy of meta_information.dedupKey for a reliable unique index. */
    dedupKey: { type: String, index: true },
  },
  collectionOptions("notifications"),
);

applyBasePlugins(NotificationSchema, { collection: "notifications", paranoid: false });

NotificationSchema.index({ userId: 1, created_at: -1 });
NotificationSchema.index({ userId: 1, isRead: 1, created_at: -1 });
NotificationSchema.index({ userId: 1, "meta_information.dedupKey": 1, created_at: -1 });
NotificationSchema.index(
  { userId: 1, dedupKey: 1 },
  { unique: true, sparse: true },
);

const Notification = mongoose.models.Notification ?? mongoose.model("Notification", NotificationSchema);
export default Notification;
