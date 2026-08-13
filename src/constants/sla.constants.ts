import { QuotePipelineStatus } from "@constants/quotePipeline.constants";

export enum SlaStatus {
	ON_TRACK = "ON_TRACK",
	WARNING = "WARNING",
	DELAYED = "DELAYED",
	CRITICAL = "CRITICAL",
}

export enum SlaResponsibilityType {
	INTERNAL = "INTERNAL",
	EXTERNAL = "EXTERNAL",
}

export type SlaStageConfigSeed = {
	stage: string;
	label: string;
	enabled: boolean;
	standard_hours: number;
	warning_hours: number;
	escalation_hours: number;
	critical_hours: number;
	responsible_department: string;
	responsible_role: string;
};

/** Stages that do not run an SLA timer */
export const SLA_UNTIMED_STAGES = new Set<string>([
	QuotePipelineStatus.DRAFT,
	QuotePipelineStatus.DECLINED_CANCELLED,
	QuotePipelineStatus.JOB_CLOSED,
]);

export const DEFAULT_SLA_STAGE_CONFIGS: SlaStageConfigSeed[] = [
	{
		stage: QuotePipelineStatus.PENDING,
		label: "Pending Quotes",
		enabled: true,
		standard_hours: 48,
		warning_hours: 36,
		escalation_hours: 48,
		critical_hours: 72,
		responsible_department: "Sales",
		responsible_role: "SALES_EXECUTIVE",
	},
	{
		stage: QuotePipelineStatus.ACCEPTED,
		label: "Accepted Quotes",
		enabled: true,
		standard_hours: 24,
		warning_hours: 18,
		escalation_hours: 24,
		critical_hours: 48,
		responsible_department: "Operations",
		responsible_role: "OPERATIONS_MANAGER",
	},
	{
		stage: QuotePipelineStatus.STOCK_ORDERED,
		label: "Stock Ordered",
		enabled: true,
		standard_hours: 24,
		warning_hours: 18,
		escalation_hours: 24,
		critical_hours: 48,
		responsible_department: "Operations",
		responsible_role: "OPERATIONS_MANAGER",
	},
	{
		stage: QuotePipelineStatus.STOCK_DELIVERED,
		label: "Stock Delivered",
		enabled: true,
		standard_hours: 24,
		warning_hours: 18,
		escalation_hours: 24,
		critical_hours: 48,
		responsible_department: "Operations",
		responsible_role: "OPERATIONS_MANAGER",
	},
	{
		stage: QuotePipelineStatus.INSTALLATION_SCHEDULED,
		label: "Installation Scheduled",
		enabled: true,
		standard_hours: 72,
		warning_hours: 48,
		escalation_hours: 72,
		critical_hours: 96,
		responsible_department: "Operations",
		responsible_role: "OPERATIONS_MANAGER",
	},
	{
		stage: QuotePipelineStatus.PRE_APPROVAL,
		label: "Pre Approval Process",
		enabled: true,
		standard_hours: 48,
		warning_hours: 36,
		escalation_hours: 48,
		critical_hours: 72,
		responsible_department: "Operations",
		responsible_role: "OPERATIONS_MANAGER",
	},
	{
		stage: QuotePipelineStatus.INSTALLATION_IN_PROGRESS,
		label: "Installation In Progress",
		enabled: true,
		standard_hours: 48,
		warning_hours: 36,
		escalation_hours: 48,
		critical_hours: 72,
		responsible_department: "Operations",
		responsible_role: "INSTALLER",
	},
	{
		stage: QuotePipelineStatus.INSTALLATION_COMPLETED,
		label: "Installation Completed",
		enabled: true,
		standard_hours: 24,
		warning_hours: 18,
		escalation_hours: 24,
		critical_hours: 48,
		responsible_department: "Operations",
		responsible_role: "OPERATIONS_MANAGER",
	},
	{
		stage: QuotePipelineStatus.GRID_PROCESS,
		label: "Grid Process",
		enabled: true,
		standard_hours: 48,
		warning_hours: 36,
		escalation_hours: 48,
		critical_hours: 72,
		responsible_department: "Operations",
		responsible_role: "OPERATIONS_MANAGER",
	},
	{
		stage: QuotePipelineStatus.CX_PAYMENT_PENDING,
		label: "Cx Payment Pending",
		enabled: true,
		standard_hours: 48,
		warning_hours: 36,
		escalation_hours: 48,
		critical_hours: 72,
		responsible_department: "Finance",
		responsible_role: "ACCOUNTS_MANAGER",
	},
	{
		stage: QuotePipelineStatus.CX_PAYMENT_RECEIVED,
		label: "Cx Payment Received",
		enabled: true,
		standard_hours: 24,
		warning_hours: 18,
		escalation_hours: 24,
		critical_hours: 48,
		responsible_department: "Finance",
		responsible_role: "ACCOUNTS_MANAGER",
	},
	{
		stage: QuotePipelineStatus.REBATE_CLAIM_SUBMIT,
		label: "Rebate Claim Submit",
		enabled: true,
		standard_hours: 48,
		warning_hours: 36,
		escalation_hours: 48,
		critical_hours: 72,
		responsible_department: "Finance",
		responsible_role: "ACCOUNTS_MANAGER",
	},
	{
		stage: QuotePipelineStatus.REBATE_RECEIVED,
		label: "Rebate Received",
		enabled: true,
		standard_hours: 24,
		warning_hours: 18,
		escalation_hours: 24,
		critical_hours: 48,
		responsible_department: "Finance",
		responsible_role: "ACCOUNTS_MANAGER",
	},
	{
		stage: QuotePipelineStatus.FEEDBACK_REFERRAL,
		label: "Feedback & Referral",
		enabled: true,
		standard_hours: 72,
		warning_hours: 48,
		escalation_hours: 72,
		critical_hours: 120,
		responsible_department: "Customer Support",
		responsible_role: "CUSTOMER_SUPPORT_EXECUTIVE",
	},
];

export type DelayReasonSeed = {
	code: string;
	label: string;
	category: string;
	is_external: boolean;
	responsibility_party: string;
};

export const DEFAULT_DELAY_REASONS: DelayReasonSeed[] = [
	// Customer
	{ code: "WAITING_FOR_CUSTOMER", label: "Waiting for Customer", category: "Customer Related", is_external: true, responsibility_party: "Customer" },
	{ code: "CUSTOMER_NOT_AVAILABLE", label: "Customer Not Available", category: "Customer Related", is_external: true, responsibility_party: "Customer" },
	{ code: "CUSTOMER_DOCUMENTS_PENDING", label: "Customer Documents Pending", category: "Customer Related", is_external: true, responsibility_party: "Customer" },
	{ code: "CUSTOMER_PAYMENT_PENDING", label: "Customer Payment Pending", category: "Customer Related", is_external: true, responsibility_party: "Customer" },
	{ code: "CUSTOMER_REQUESTED_RESCHEDULE", label: "Customer Requested Reschedule", category: "Customer Related", is_external: true, responsibility_party: "Customer" },
	// Installer
	{ code: "INSTALLER_NOT_AVAILABLE", label: "Installer Not Available", category: "Installer Related", is_external: true, responsibility_party: "Installer" },
	{ code: "INSTALLER_PORTAL_ACCESS_PENDING", label: "Installer Portal Access Pending", category: "Installer Related", is_external: true, responsibility_party: "Installer" },
	{ code: "INSTALLER_DOCUMENTS_PENDING", label: "Installer Documents Pending", category: "Installer Related", is_external: true, responsibility_party: "Installer" },
	{ code: "INSTALLATION_DELAY", label: "Installation Delay", category: "Installer Related", is_external: true, responsibility_party: "Installer" },
	{ code: "INSTALLER_RESCHEDULE", label: "Installer Reschedule", category: "Installer Related", is_external: true, responsibility_party: "Installer" },
	// DNSP
	{ code: "DNSP_PROCESSING_DELAY", label: "DNSP Processing Delay", category: "DNSP Related", is_external: true, responsibility_party: "DNSP" },
	{ code: "GRID_APPROVAL_PENDING", label: "Grid Approval Pending", category: "DNSP Related", is_external: true, responsibility_party: "DNSP" },
	{ code: "DNSP_REQUIRES_ADDITIONAL_INFO", label: "DNSP Requires Additional Information", category: "DNSP Related", is_external: true, responsibility_party: "DNSP" },
	// Finance
	{ code: "FINANCE_APPLICATION_PENDING", label: "Finance Application Pending", category: "Finance Related", is_external: true, responsibility_party: "Finance Partner" },
	{ code: "FINANCE_DOCUMENTS_PENDING", label: "Finance Documents Pending", category: "Finance Related", is_external: true, responsibility_party: "Finance Partner" },
	{ code: "FINANCE_APPROVAL_PENDING", label: "Finance Approval Pending", category: "Finance Related", is_external: true, responsibility_party: "Finance Partner" },
	{ code: "FINANCE_PARTNER_DELAY", label: "Finance Partner Delay", category: "Finance Related", is_external: true, responsibility_party: "Finance Partner" },
	// Internal
	{ code: "INTERNAL_PROCESSING_DELAY", label: "Internal Processing Delay", category: "Internal Operations", is_external: false, responsibility_party: "Operations" },
	{ code: "DOCUMENT_PENDING", label: "Document Pending", category: "Internal Operations", is_external: false, responsibility_party: "Operations" },
	{ code: "STAFF_ACTION_PENDING", label: "Staff Action Pending", category: "Internal Operations", is_external: false, responsibility_party: "Operations" },
	{ code: "CRM_UPDATE_PENDING", label: "CRM Update Pending", category: "Internal Operations", is_external: false, responsibility_party: "Operations" },
	{ code: "INCORRECT_INFORMATION", label: "Incorrect Information", category: "Internal Operations", is_external: false, responsibility_party: "Operations" },
	{ code: "INTERNAL_APPROVAL_PENDING", label: "Internal Approval Pending", category: "Internal Operations", is_external: false, responsibility_party: "Management" },
	// Stock
	{ code: "STOCK_UNAVAILABLE", label: "Stock Unavailable", category: "Stock Related", is_external: true, responsibility_party: "Other External Party" },
	{ code: "STOCK_ORDERED", label: "Stock Ordered", category: "Stock Related", is_external: true, responsibility_party: "Other External Party" },
	{ code: "STOCK_DELIVERY_DELAYED", label: "Stock Delivery Delayed", category: "Stock Related", is_external: true, responsibility_party: "Other External Party" },
	{ code: "PRODUCT_CHANGE_REQUIRED", label: "Product Change Required", category: "Stock Related", is_external: false, responsibility_party: "Operations" },
	// Technical
	{ code: "CRM_ISSUE", label: "CRM Issue", category: "Technical", is_external: false, responsibility_party: "Technical Team" },
	{ code: "PORTAL_ISSUE", label: "Portal Issue", category: "Technical", is_external: true, responsibility_party: "Technical Team" },
	{ code: "TECHNICAL_ISSUE", label: "Technical Issue", category: "Technical", is_external: false, responsibility_party: "Technical Team" },
	{ code: "SYSTEM_ACCESS_PROBLEM", label: "System Access Problem", category: "Technical", is_external: false, responsibility_party: "Technical Team" },
	// Other
	{ code: "OTHER_REASON", label: "Other Reason", category: "Other", is_external: false, responsibility_party: "Other External Party" },
];

export const SLA_MANAGEMENT_ROLES = new Set([
	"SUPER_ADMIN",
	"ADMIN",
	"CEO",
	"MANAGER",
	"OPERATIONS_MANAGER",
	"ACCOUNTS_MANAGER",
]);
