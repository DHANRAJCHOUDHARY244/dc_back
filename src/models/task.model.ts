import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";
import { TaskPriority, MasterTaskStatus } from "@constants/masterTask.constants";

/**
 * Expanded Master Task schema.
 * Keeps legacy fields (name, instruction, user_id, lead_id, DONE status).
 * Type/status are free strings so old + new values coexist.
 */
const TaskSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		/** Human-readable ID e.g. TASK-SE-2026-001025 */
		task_code: { type: String, unique: true, sparse: true, index: true },
		type: { type: String, required: true, index: true },
		category: { type: String, default: "General", index: true },
		priority: {
			type: String,
			enum: Object.values(TaskPriority),
			default: TaskPriority.NORMAL,
			index: true,
		},
		user_id: { type: Number, required: true, index: true },
		owner_id: { type: Number, default: null, index: true },
		assigned_by: { type: Number, default: null },
		manager_id: { type: Number, default: null },
		lead_id: { type: Number, index: true },
		quote_id: { type: Number, index: true },
		customer_id: { type: Number, index: true },
		customer_name: { type: String, default: "" },
		employee_code: { type: String, default: "" },
		department: { type: String, default: "" },
		team: { type: String, default: "" },
		name: { type: String },
		title: { type: String, default: "" },
		instruction: { type: String },
		description: { type: String, default: "" },
		status: {
			type: String,
			default: MasterTaskStatus.PENDING,
			index: true,
		},
		closing_message: { type: String },
		due_date: { type: Date, index: true },
		start_date: { type: Date },
		due_time: { type: String, default: "" },
		start_time: { type: String, default: "" },
		reminder_minutes: { type: Number, default: null },
		reminder_sent: { type: Boolean, default: false },
		recurrence: {
			type: String,
			enum: ["NONE", "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"],
			default: "NONE",
		},
		parent_task_id: { type: Number, default: null },
		checklist: jsonArray,
		comments: jsonArray,
		attachments: jsonArray,
		escalation_level: { type: Number, default: 0, index: true },
		escalation_history: jsonArray,
		delay_party: {
			type: String,
			default: null,
		},
		related_record: { type: Schema.Types.Mixed, default: null },
		closing_date: { type: Date },
		created_by: { type: Number },
		progress: jsonArray,
		is_follow_up: { type: Boolean, default: false, index: true },
		follow_up_outcome: { type: String, default: null },
	},
	collectionOptions("tasks"),
);

TaskSchema.virtual("user", { ref: "User", localField: "user_id", foreignField: "id", justOne: true });
TaskSchema.virtual("owner", { ref: "User", localField: "owner_id", foreignField: "id", justOne: true });
TaskSchema.virtual("creator", { ref: "User", localField: "created_by", foreignField: "id", justOne: true });
TaskSchema.virtual("lead", { ref: "Lead", localField: "lead_id", foreignField: "id", justOne: true });
TaskSchema.virtual("assignee_manager", {
	ref: "User",
	localField: "manager_id",
	foreignField: "id",
	justOne: true,
});

applyBasePlugins(TaskSchema, { collection: "tasks", paranoid: true });

const Task = mongoose.models.Task ?? mongoose.model("Task", TaskSchema);
export default Task;
