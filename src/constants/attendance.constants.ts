/** Attendance & HR payroll constants */

export enum AttendanceStatus {
	PRESENT = "PRESENT",
	LATE = "LATE",
	HALF_DAY = "HALF_DAY",
	ABSENT = "ABSENT",
	PAID_LEAVE = "PAID_LEAVE",
	UNPAID_LEAVE = "UNPAID_LEAVE",
	WEEKLY_OFF = "WEEKLY_OFF",
	PUBLIC_HOLIDAY = "PUBLIC_HOLIDAY",
	WFH = "WFH",
	ON_DUTY = "ON_DUTY",
}

export const ATTENDANCE_STATUSES = Object.values(AttendanceStatus);

export enum AttendanceSource {
	SELF_PUNCH = "SELF_PUNCH",
	HR_MARK = "HR_MARK",
	SYSTEM = "SYSTEM",
	LEAVE = "LEAVE",
	CORRECTION = "CORRECTION",
}

export enum EmploymentStatus {
	ACTIVE = "ACTIVE",
	INACTIVE = "INACTIVE",
	PROBATION = "PROBATION",
	TERMINATED = "TERMINATED",
	ON_NOTICE = "ON_NOTICE",
}

export enum SalaryType {
	MONTHLY = "MONTHLY",
	HOURLY = "HOURLY",
	DAILY = "DAILY",
}

export enum LeaveRequestStatus {
	PENDING_TL = "PENDING_TL",
	PENDING_HR = "PENDING_HR",
	APPROVED = "APPROVED",
	REJECTED = "REJECTED",
	CANCELLED = "CANCELLED",
}

export enum CorrectionStatus {
	PENDING_TL = "PENDING_TL",
	PENDING_HR = "PENDING_HR",
	APPROVED = "APPROVED",
	REJECTED = "REJECTED",
	CANCELLED = "CANCELLED",
}

/** Statuses that do not count as absence / do not reduce attendance % */
export const NON_ABSENCE_STATUSES = [
	AttendanceStatus.PRESENT,
	AttendanceStatus.LATE,
	AttendanceStatus.HALF_DAY,
	AttendanceStatus.PAID_LEAVE,
	AttendanceStatus.WEEKLY_OFF,
	AttendanceStatus.PUBLIC_HOLIDAY,
	AttendanceStatus.WFH,
	AttendanceStatus.ON_DUTY,
];

/** Default deductible for salary (can be overridden in settings) */
export const DEFAULT_DEDUCTIBLE_STATUSES = [
	AttendanceStatus.ABSENT,
	AttendanceStatus.UNPAID_LEAVE,
];

export const DEFAULT_LEAVE_TYPES = [
	{ code: "CL", name: "Casual Leave", is_paid: true, default_days: 12 },
	{ code: "SL", name: "Sick Leave", is_paid: true, default_days: 12 },
	{ code: "PL", name: "Paid Leave", is_paid: true, default_days: 0 },
	{ code: "UL", name: "Unpaid Leave", is_paid: false, default_days: 0 },
	{ code: "EL", name: "Emergency Leave", is_paid: true, default_days: 3 },
	{ code: "OT", name: "Other", is_paid: false, default_days: 0 },
];

export const HR_ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "HR_EXECUTIVE", "CEO"];
export const HR_MANAGER_ROLES = [...HR_ADMIN_ROLES, "MANAGER", "OPERATIONS_MANAGER"];

/** Final HR approval (leave, corrections) — HR Executive + Super Admin only. */
export const HR_LEAVE_APPROVER_ROLES = ["SUPER_ADMIN", "HR_EXECUTIVE"];

/** Team-lead first approval (managers only — not CEO/Admin). */
export const HR_TEAM_LEAD_ROLES = ["MANAGER", "OPERATIONS_MANAGER"];

/** Onboarding & employee setup — HR Executive + Super Admin. */
export const HR_ONBOARDING_ROLES = ["SUPER_ADMIN", "HR_EXECUTIVE"];

export const ONBOARDING_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;

export const DEFAULT_ONBOARDING_TASKS = [
	{ key: "profile", label: "Complete employee profile" },
	{ key: "documents", label: "Offer / appointment letter" },
	{ key: "shift", label: "Assign shift & weekly off" },
	{ key: "manager", label: "Assign manager & team leader" },
	{ key: "id_card", label: "Generate employee ID card" },
	{ key: "training", label: "Assign mandatory training" },
	{ key: "probation", label: "Probation review" },
] as const;

export function dayKey(d: Date | string): string {
	const x = new Date(d);
	const y = x.getFullYear();
	const m = String(x.getMonth() + 1).padStart(2, "0");
	const day = String(x.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date | string): Date {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
}

export function endOfDay(d: Date | string): Date {
	const x = new Date(d);
	x.setHours(23, 59, 59, 999);
	return x;
}

export function parseHhMm(value: string): { h: number; m: number } {
	const [h, m] = String(value || "09:00").split(":").map((n) => Number(n) || 0);
	return { h, m };
}

export function minutesBetween(a: Date, b: Date): number {
	return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

export function formatHoursMinutes(totalMinutes: number): string {
	const mins = Math.max(0, Math.round(totalMinutes));
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return `${h}h ${String(m).padStart(2, "0")}m`;
}
