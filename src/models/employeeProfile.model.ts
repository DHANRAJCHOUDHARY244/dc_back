import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";
import { EmploymentStatus, SalaryType } from "@constants/attendance.constants";

const EmployeeProfileSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		user_id: { type: Number, required: true, unique: true, index: true },
		employee_code: { type: String, default: "", unique: true, sparse: true, index: true },
		department: { type: String, default: "" },
		designation: { type: String, default: "" },
		team: { type: String, default: "" },
		manager_id: { type: Number, default: null, index: true },
		team_leader_id: { type: Number, default: null, index: true },
		joining_date: { type: Date, default: null },
		employment_status: {
			type: String,
			enum: Object.values(EmploymentStatus),
			default: EmploymentStatus.ACTIVE,
			index: true,
		},
		salary_type: {
			type: String,
			enum: Object.values(SalaryType),
			default: SalaryType.MONTHLY,
		},
		monthly_salary: { type: Number, default: 0 },
		working_hours: { type: Number, default: 8 },
		shift_id: { type: Number, default: null },
		/** 0=Sun … 6=Sat — default Sunday */
		weekly_off_days: { type: [Number], default: () => [0] },
		attendance_enabled: { type: Boolean, default: true },
		notes: { type: String, default: "" },
		onboarding_status: {
			type: String,
			enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"],
			default: "NOT_STARTED",
			index: true,
		},
		onboarding_tasks: {
			type: [
				{
					key: String,
					label: String,
					done: { type: Boolean, default: false },
					done_at: { type: Date, default: null },
				},
			],
			default: [],
		},
		onboarding_completed_at: { type: Date, default: null },
	},
	collectionOptions("employee_profiles"),
);

EmployeeProfileSchema.virtual("user", {
	ref: "User",
	localField: "user_id",
	foreignField: "id",
	justOne: true,
});
EmployeeProfileSchema.virtual("manager", {
	ref: "User",
	localField: "manager_id",
	foreignField: "id",
	justOne: true,
});
EmployeeProfileSchema.virtual("team_leader", {
	ref: "User",
	localField: "team_leader_id",
	foreignField: "id",
	justOne: true,
});
EmployeeProfileSchema.virtual("shift", {
	ref: "Shift",
	localField: "shift_id",
	foreignField: "id",
	justOne: true,
});

applyBasePlugins(EmployeeProfileSchema, { collection: "employee_profiles", paranoid: true });

const EmployeeProfile =
	mongoose.models.EmployeeProfile ?? mongoose.model("EmployeeProfile", EmployeeProfileSchema);
export default EmployeeProfile;
