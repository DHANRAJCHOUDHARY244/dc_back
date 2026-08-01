import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const ActivityTrackerSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    user_id: { type: Number, required: true },
    date: { type: Date, required: true },
    activities: { type: Schema.Types.Mixed, required: true, default: [] },
    is_leave: { type: Boolean, default: false },
    leave_reason: { type: String },
  },
  collectionOptions("activity_tracker"),
);

ActivityTrackerSchema.virtual("user", {
  ref: "User",
  localField: "user_id",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(ActivityTrackerSchema, { collection: "activity_tracker", paranoid: false });

const ActivityTracker =
  mongoose.models.ActivityTracker ?? mongoose.model("ActivityTracker", ActivityTrackerSchema);
export default ActivityTracker;
