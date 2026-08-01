import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";
import { TaskType } from "@constants/taskAndProgress.enum";

const TaskSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    type: { type: String, required: true, enum: Object.values(TaskType) },
    user_id: { type: Number, required: true },
    lead_id: { type: Number },
    name: { type: String },
    instruction: { type: String },
    status: { type: String, default: "PENDING", enum: ["PENDING", "DONE", "PARTIALLY_DONE"] },
    closing_message: { type: String },
    due_date: { type: Date },
    closing_date: { type: Date },
    created_by: { type: Number },
    progress: jsonArray,
  },
  collectionOptions("tasks"),
);

TaskSchema.virtual("user", { ref: "User", localField: "user_id", foreignField: "id", justOne: true });
TaskSchema.virtual("creator", { ref: "User", localField: "created_by", foreignField: "id", justOne: true });
TaskSchema.virtual("lead", { ref: "Lead", localField: "lead_id", foreignField: "id", justOne: true });

applyBasePlugins(TaskSchema, { collection: "tasks", paranoid: true });

const Task = mongoose.models.Task ?? mongoose.model("Task", TaskSchema);
export default Task;
