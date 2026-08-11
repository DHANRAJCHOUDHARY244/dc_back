import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonObject } from "@db/plugins";

export const TRAINING_MEDIA_TYPES = ["pdf", "document", "video", "image", "link", "zip", "other"] as const;
export const TRAINING_PROGRESS_STATUSES = [
	"ASSIGNED",
	"STARTED",
	"IN_PROGRESS",
	"COMPLETED",
	"PENDING",
	"OVERDUE",
	"FAILED",
	"REATTEMPT",
] as const;
export const TRAINING_RESOURCE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const TRAINING_ASSIGN_TARGETS = ["USER", "ROLE", "DEPARTMENT", "DESIGNATION", "COMPANY"] as const;

const TrainingCategorySchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		name: { type: String, required: true },
		slug: { type: String, required: true, index: true },
		parent_id: { type: Number, default: null, index: true },
		description: { type: String, default: "" },
		sort_order: { type: Number, default: 0 },
		is_active: { type: Boolean, default: true },
	},
	collectionOptions("training_categories"),
);

applyBasePlugins(TrainingCategorySchema, { collection: "training_categories", paranoid: true });

const TrainingResourceSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		title: { type: String, required: true, index: true },
		description: { type: String, default: "" },
		category_id: { type: Number, default: null, index: true },
		subcategory_id: { type: Number, default: null, index: true },
		media_type: {
			type: String,
			enum: TRAINING_MEDIA_TYPES,
			default: "document",
			index: true,
		},
		file: jsonObject,
		external_url: { type: String, default: "" },
		trainer_user_id: { type: Number, default: null },
		version: { type: String, default: "1.0" },
		language: { type: String, default: "en" },
		role_names: { type: [String], default: () => [] },
		departments: { type: [String], default: () => [] },
		is_mandatory: { type: Boolean, default: false, index: true },
		estimated_minutes: { type: Number, default: 15 },
		status: {
			type: String,
			enum: TRAINING_RESOURCE_STATUSES,
			default: "DRAFT",
			index: true,
		},
		publish_date: { type: Date, default: null },
		expiry_date: { type: Date, default: null },
		completion_rule: {
			type: String,
			enum: ["OPEN", "WATCH_PERCENT", "DWELL_SECONDS"],
			default: "OPEN",
		},
		completion_threshold: { type: Number, default: 80 },
	},
	collectionOptions("training_resources"),
);

applyBasePlugins(TrainingResourceSchema, { collection: "training_resources", paranoid: true });

const TrainingCourseSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		title: { type: String, required: true },
		description: { type: String, default: "" },
		category_id: { type: Number, default: null, index: true },
		is_mandatory: { type: Boolean, default: false, index: true },
		status: {
			type: String,
			enum: TRAINING_RESOURCE_STATUSES,
			default: "DRAFT",
			index: true,
		},
		modules: {
			type: [
				{
					title: { type: String, default: "" },
					resource_id: { type: Number, required: true },
					sort_order: { type: Number, default: 0 },
				},
			],
			default: () => [],
		},
		role_names: { type: [String], default: () => [] },
		departments: { type: [String], default: () => [] },
		estimated_minutes: { type: Number, default: 0 },
		publish_date: { type: Date, default: null },
	},
	collectionOptions("training_courses"),
);

applyBasePlugins(TrainingCourseSchema, { collection: "training_courses", paranoid: true });

const TrainingAssignmentSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		resource_id: { type: Number, default: null, index: true },
		course_id: { type: Number, default: null, index: true },
		target_type: {
			type: String,
			enum: TRAINING_ASSIGN_TARGETS,
			required: true,
			index: true,
		},
		target_value: { type: String, default: "" },
		user_id: { type: Number, default: null, index: true },
		is_mandatory: { type: Boolean, default: false },
		deadline: { type: Date, default: null, index: true },
		assigned_by: { type: Number, default: null },
		notes: { type: String, default: "" },
	},
	collectionOptions("training_assignments"),
);

applyBasePlugins(TrainingAssignmentSchema, { collection: "training_assignments", paranoid: true });

const TrainingProgressSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		user_id: { type: Number, required: true, index: true },
		employee_code: { type: String, default: "", index: true },
		resource_id: { type: Number, default: null, index: true },
		course_id: { type: Number, default: null, index: true },
		assignment_id: { type: Number, default: null, index: true },
		status: {
			type: String,
			enum: TRAINING_PROGRESS_STATUSES,
			default: "ASSIGNED",
			index: true,
		},
		progress_percent: { type: Number, default: 0 },
		watch_percent: { type: Number, default: 0 },
		dwell_seconds: { type: Number, default: 0 },
		opened_at: { type: Date, default: null },
		started_at: { type: Date, default: null },
		completed_at: { type: Date, default: null },
		last_accessed_at: { type: Date, default: null },
		score: { type: Number, default: null },
		is_mandatory: { type: Boolean, default: false },
		deadline: { type: Date, default: null },
	},
	collectionOptions("training_progress"),
);

TrainingProgressSchema.index({ user_id: 1, resource_id: 1 }, { unique: false });
TrainingProgressSchema.index({ user_id: 1, course_id: 1 }, { unique: false });

applyBasePlugins(TrainingProgressSchema, { collection: "training_progress", paranoid: true });

const TrainingVersionSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		resource_id: { type: Number, required: true, index: true },
		version: { type: String, required: true },
		file: jsonObject,
		external_url: { type: String, default: "" },
		changed_by: { type: Number, default: null },
		change_note: { type: String, default: "" },
	},
	collectionOptions("training_versions"),
);

applyBasePlugins(TrainingVersionSchema, { collection: "training_versions", paranoid: false });

const TrainingSettingsSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		video_complete_percent: { type: Number, default: 80 },
		pdf_dwell_seconds: { type: Number, default: 30 },
		reminder_days_before_deadline: { type: Number, default: 3 },
	},
	collectionOptions("training_settings"),
);

applyBasePlugins(TrainingSettingsSchema, { collection: "training_settings", paranoid: false });

export const TrainingCategory =
	mongoose.models.TrainingCategory ?? mongoose.model("TrainingCategory", TrainingCategorySchema);
export const TrainingResource =
	mongoose.models.TrainingResource ?? mongoose.model("TrainingResource", TrainingResourceSchema);
export const TrainingCourse =
	mongoose.models.TrainingCourse ?? mongoose.model("TrainingCourse", TrainingCourseSchema);
export const TrainingAssignment =
	mongoose.models.TrainingAssignment ?? mongoose.model("TrainingAssignment", TrainingAssignmentSchema);
export const TrainingProgress =
	mongoose.models.TrainingProgress ?? mongoose.model("TrainingProgress", TrainingProgressSchema);
export const TrainingVersion =
	mongoose.models.TrainingVersion ?? mongoose.model("TrainingVersion", TrainingVersionSchema);
export const TrainingSettings =
	mongoose.models.TrainingSettings ?? mongoose.model("TrainingSettings", TrainingSettingsSchema);

export default {
	TrainingCategory,
	TrainingResource,
	TrainingCourse,
	TrainingAssignment,
	TrainingProgress,
	TrainingVersion,
	TrainingSettings,
};
