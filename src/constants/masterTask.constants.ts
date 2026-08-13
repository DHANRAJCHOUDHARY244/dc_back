/** Master Task / Follow-up / Escalation constants */

export enum TaskPriority {
	LOW = "LOW",
	NORMAL = "NORMAL",
	HIGH = "HIGH",
	URGENT = "URGENT",
	CRITICAL = "CRITICAL",
}

export enum MasterTaskStatus {
	PENDING = "PENDING",
	IN_PROGRESS = "IN_PROGRESS",
	WAITING_CUSTOMER = "WAITING_CUSTOMER",
	WAITING_INSTALLER = "WAITING_INSTALLER",
	WAITING_DNSP = "WAITING_DNSP",
	WAITING_FINANCE = "WAITING_FINANCE",
	WAITING_DOCUMENTS = "WAITING_DOCUMENTS",
	COMPLETED = "COMPLETED",
	CANCELLED = "CANCELLED",
	OVERDUE = "OVERDUE",
	ESCALATED = "ESCALATED",
	/** Legacy */
	DONE = "DONE",
	PARTIALLY_DONE = "PARTIALLY_DONE",
}

export const TASK_OPEN_STATUSES = [
	MasterTaskStatus.PENDING,
	MasterTaskStatus.IN_PROGRESS,
	MasterTaskStatus.WAITING_CUSTOMER,
	MasterTaskStatus.WAITING_INSTALLER,
	MasterTaskStatus.WAITING_DNSP,
	MasterTaskStatus.WAITING_FINANCE,
	MasterTaskStatus.WAITING_DOCUMENTS,
	MasterTaskStatus.OVERDUE,
	MasterTaskStatus.ESCALATED,
	MasterTaskStatus.PARTIALLY_DONE,
];

export const TASK_DONE_STATUSES = [MasterTaskStatus.COMPLETED, MasterTaskStatus.DONE, MasterTaskStatus.CANCELLED];

export type TaskTypeDef = {
	code: string;
	label: string;
	category: string;
};

export const DEFAULT_TASK_TYPES: TaskTypeDef[] = [
	// Sales
	{ code: "LEAD_CALL", label: "Lead Call", category: "Sales" },
	{ code: "FOLLOW_UP", label: "Follow-up", category: "Sales" },
	{ code: "APPOINTMENT", label: "Appointment", category: "Sales" },
	{ code: "QUOTE_FOLLOW_UP", label: "Quote Follow-up", category: "Sales" },
	{ code: "CLOSING", label: "Closing", category: "Sales" },
	{ code: "CUSTOMER_CALLBACK", label: "Customer Callback", category: "Sales" },
	{ code: "LEAD_VISIT", label: "Lead Visit", category: "Sales" },
	{ code: "LEAD_CONVERSION", label: "Lead Conversion", category: "Sales" },
	{ code: "LEAD_FOLLOW_UP", label: "Lead Follow-up", category: "Sales" },
	// Finance
	{ code: "FINANCE_APPLICATION", label: "Finance Application", category: "Finance" },
	{ code: "DOCUMENT_COLLECTION", label: "Document Collection", category: "Finance" },
	{ code: "FINANCE_FOLLOW_UP", label: "Finance Follow-up", category: "Finance" },
	{ code: "APPROVAL_FOLLOW_UP", label: "Approval Follow-up", category: "Finance" },
	{ code: "PAYMENT_FOLLOW_UP", label: "Payment Follow-up", category: "Finance" },
	// Operations
	{ code: "JOB_REVIEW", label: "Job Review", category: "Operations" },
	{ code: "PRE_APPROVAL", label: "Pre-Approval", category: "Operations" },
	{ code: "GRID_CONNECTION", label: "Grid Connection", category: "Operations" },
	{ code: "INSTALLER_COORDINATION", label: "Installer Coordination", category: "Operations" },
	{ code: "INSTALLATION_SCHEDULING", label: "Installation Scheduling", category: "Operations" },
	{ code: "INSTALLATION_COMPLETION", label: "Installation Completion", category: "Operations" },
	{ code: "COMPLIANCE_DOCUMENTS", label: "Compliance Documents", category: "Operations" },
	{ code: "SLA_DELAY_RESOLVE", label: "Resolve Delayed Job", category: "Operations" },
	{ code: "INSTALLATION_VISIT", label: "Installation Visit", category: "Operations" },
	{ code: "INSTALLATION_SERVICE", label: "Installation Service", category: "Operations" },
	// Support
	{ code: "CUSTOMER_COMPLAINT", label: "Customer Complaint", category: "Customer Support" },
	{ code: "ISSUE_RESOLUTION", label: "Issue Resolution", category: "Customer Support" },
	{ code: "FEEDBACK", label: "Feedback", category: "Customer Support" },
	{ code: "CUSTOMER_SUPPORT", label: "Customer Support", category: "Customer Support" },
	// HR
	{ code: "EMPLOYEE_TASK", label: "Employee Task", category: "HR" },
	{ code: "ATTENDANCE_ISSUE", label: "Attendance Issue", category: "HR" },
	{ code: "TRAINING", label: "Training", category: "HR" },
	{ code: "PERFORMANCE_REVIEW", label: "Performance Review", category: "HR" },
	{ code: "RECRUITMENT", label: "Recruitment", category: "HR" },
	{ code: "INTERVIEW", label: "Interview", category: "HR" },
	{ code: "ONBOARDING", label: "Onboarding", category: "HR" },
	// General
	{ code: "MEETING", label: "Meeting", category: "General" },
	{ code: "INTERNAL_TASK", label: "Internal Task", category: "General" },
	{ code: "MANAGEMENT_TASK", label: "Management Task", category: "General" },
	{ code: "OTHER", label: "Other", category: "General" },
];

export const FOLLOW_UP_OUTCOMES = [
	"CUSTOMER_INTERESTED",
	"CALLBACK_REQUESTED",
	"QUOTE_SENT",
	"WAITING_FOR_CUSTOMER",
	"FINANCE_PENDING",
	"NOT_INTERESTED",
	"SOLD",
	"LOST",
	"RESCHEDULE",
] as const;

export const DEFAULT_ESCALATION_RULES = [
	{ task_type: "FOLLOW_UP", warning_hours: 2, escalate_l1_hours: 6, escalate_l2_hours: 24, escalate_l3_hours: 48 },
	{ task_type: "LEAD_FOLLOW_UP", warning_hours: 2, escalate_l1_hours: 6, escalate_l2_hours: 24, escalate_l3_hours: 48 },
	{ task_type: "QUOTE_FOLLOW_UP", warning_hours: 4, escalate_l1_hours: 12, escalate_l2_hours: 24, escalate_l3_hours: 48 },
	{ task_type: "FINANCE_APPLICATION", warning_hours: 24, escalate_l1_hours: 48, escalate_l2_hours: 72, escalate_l3_hours: 96 },
	{ task_type: "PRE_APPROVAL", warning_hours: 24, escalate_l1_hours: 48, escalate_l2_hours: 72, escalate_l3_hours: 96 },
	{ task_type: "GRID_CONNECTION", warning_hours: 48, escalate_l1_hours: 72, escalate_l2_hours: 96, escalate_l3_hours: 120 },
	{ task_type: "CUSTOMER_COMPLAINT", warning_hours: 4, escalate_l1_hours: 24, escalate_l2_hours: 48, escalate_l3_hours: 72 },
	{ task_type: "COMPLIANCE_DOCUMENTS", warning_hours: 12, escalate_l1_hours: 24, escalate_l2_hours: 48, escalate_l3_hours: 72 },
	{ task_type: "SLA_DELAY_RESOLVE", warning_hours: 6, escalate_l1_hours: 12, escalate_l2_hours: 24, escalate_l3_hours: 48 },
	{ task_type: "*", warning_hours: 24, escalate_l1_hours: 48, escalate_l2_hours: 72, escalate_l3_hours: 96 },
];

export const MASTER_TASK_MANAGER_ROLES = new Set([
	"SUPER_ADMIN",
	"ADMIN",
	"CEO",
	"MANAGER",
	"OPERATIONS_MANAGER",
	"ACCOUNTS_MANAGER",
	"HR_EXECUTIVE",
]);
