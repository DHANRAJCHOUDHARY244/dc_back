/** Quote sales pipeline statuses (stored in Quote.kanban_status).
 * Stock Ordered / Delivered are manual pipeline stages — NOT linked to StockOrder module.
 */

export enum QuotePipelineStatus {
	DRAFT = "DRAFT",
	PENDING = "PENDING",
	ACCEPTED = "ACCEPTED",
	DECLINED_CANCELLED = "DECLINED_CANCELLED",
	STOCK_ORDERED = "STOCK_ORDERED",
	STOCK_DELIVERED = "STOCK_DELIVERED",
	INSTALLATION_SCHEDULED = "INSTALLATION_SCHEDULED",
	PRE_APPROVAL = "PRE_APPROVAL",
	INSTALLATION_IN_PROGRESS = "INSTALLATION_IN_PROGRESS",
	INSTALLATION_COMPLETED = "INSTALLATION_COMPLETED",
	GRID_PROCESS = "GRID_PROCESS",
	CX_PAYMENT_PENDING = "CX_PAYMENT_PENDING",
	CX_PAYMENT_RECEIVED = "CX_PAYMENT_RECEIVED",
	REBATE_CLAIM_SUBMIT = "REBATE_CLAIM_SUBMIT",
	REBATE_RECEIVED = "REBATE_RECEIVED",
	FEEDBACK_REFERRAL = "FEEDBACK_REFERRAL",
	JOB_CLOSED = "JOB_CLOSED",
}

/** Forward-only auto-advance path (DECLINED_CANCELLED is terminal side-path). */
export const QUOTE_PIPELINE_ORDER: QuotePipelineStatus[] = [
	QuotePipelineStatus.DRAFT,
	QuotePipelineStatus.PENDING,
	QuotePipelineStatus.ACCEPTED,
	QuotePipelineStatus.STOCK_ORDERED,
	QuotePipelineStatus.STOCK_DELIVERED,
	QuotePipelineStatus.INSTALLATION_SCHEDULED,
	QuotePipelineStatus.PRE_APPROVAL,
	QuotePipelineStatus.INSTALLATION_IN_PROGRESS,
	QuotePipelineStatus.INSTALLATION_COMPLETED,
	QuotePipelineStatus.GRID_PROCESS,
	QuotePipelineStatus.CX_PAYMENT_PENDING,
	QuotePipelineStatus.CX_PAYMENT_RECEIVED,
	QuotePipelineStatus.REBATE_CLAIM_SUBMIT,
	QuotePipelineStatus.REBATE_RECEIVED,
	QuotePipelineStatus.FEEDBACK_REFERRAL,
	QuotePipelineStatus.JOB_CLOSED,
];

export const QUOTE_PIPELINE_LABELS: Record<QuotePipelineStatus, string> = {
	[QuotePipelineStatus.DRAFT]: "Draft Quotes",
	[QuotePipelineStatus.PENDING]: "Pending Quotes",
	[QuotePipelineStatus.ACCEPTED]: "Accepted Quotes",
	[QuotePipelineStatus.DECLINED_CANCELLED]: "Declined / Cancelled Quotes",
	[QuotePipelineStatus.STOCK_ORDERED]: "Stock Ordered",
	[QuotePipelineStatus.STOCK_DELIVERED]: "Stock Delivered",
	[QuotePipelineStatus.INSTALLATION_SCHEDULED]: "Installation Scheduled",
	[QuotePipelineStatus.PRE_APPROVAL]: "Pre Approval Process",
	[QuotePipelineStatus.INSTALLATION_IN_PROGRESS]: "Installation In Progress",
	[QuotePipelineStatus.INSTALLATION_COMPLETED]: "Installation Completed",
	[QuotePipelineStatus.GRID_PROCESS]: "Grid Process",
	[QuotePipelineStatus.CX_PAYMENT_PENDING]: "Cx Payment Pending",
	[QuotePipelineStatus.CX_PAYMENT_RECEIVED]: "Cx Payment Received",
	[QuotePipelineStatus.REBATE_CLAIM_SUBMIT]: "Rebate Claim Submit",
	[QuotePipelineStatus.REBATE_RECEIVED]: "Rebate Received",
	[QuotePipelineStatus.FEEDBACK_REFERRAL]: "Feedback & Referral Follow Up",
	[QuotePipelineStatus.JOB_CLOSED]: "Job Closed",
};

export const QUOTE_PIPELINE_SHORT_LABELS: Record<QuotePipelineStatus, string> = {
	[QuotePipelineStatus.DRAFT]: "Draft",
	[QuotePipelineStatus.PENDING]: "Pending",
	[QuotePipelineStatus.ACCEPTED]: "Accepted",
	[QuotePipelineStatus.DECLINED_CANCELLED]: "Declined / Cancelled",
	[QuotePipelineStatus.STOCK_ORDERED]: "Stock Ordered",
	[QuotePipelineStatus.STOCK_DELIVERED]: "Stock Delivered",
	[QuotePipelineStatus.INSTALLATION_SCHEDULED]: "Install Scheduled",
	[QuotePipelineStatus.PRE_APPROVAL]: "Pre Approval",
	[QuotePipelineStatus.INSTALLATION_IN_PROGRESS]: "Install In Progress",
	[QuotePipelineStatus.INSTALLATION_COMPLETED]: "Install Completed",
	[QuotePipelineStatus.GRID_PROCESS]: "Grid Process",
	[QuotePipelineStatus.CX_PAYMENT_PENDING]: "Payment Pending",
	[QuotePipelineStatus.CX_PAYMENT_RECEIVED]: "Payment Received",
	[QuotePipelineStatus.REBATE_CLAIM_SUBMIT]: "Rebate Submit",
	[QuotePipelineStatus.REBATE_RECEIVED]: "Rebate Received",
	[QuotePipelineStatus.FEEDBACK_REFERRAL]: "Feedback / Referral",
	[QuotePipelineStatus.JOB_CLOSED]: "Job Closed",
};

export const ALL_PIPELINE_STATUSES = Object.values(QuotePipelineStatus);

/** Legacy / old values → canonical pipeline */
export const LEGACY_KANBAN_TO_PIPELINE: Record<string, QuotePipelineStatus> = {
	PENDING: QuotePipelineStatus.PENDING,
	ACCEPTED: QuotePipelineStatus.ACCEPTED,
	SCHEDULED: QuotePipelineStatus.INSTALLATION_SCHEDULED,
	INSTALLED: QuotePipelineStatus.INSTALLATION_COMPLETED,
	INVOICE_GENERATED: QuotePipelineStatus.CX_PAYMENT_PENDING,
	PAYMENT_PENDING: QuotePipelineStatus.CX_PAYMENT_PENDING,
	PAYMENT_COMPLETED: QuotePipelineStatus.CX_PAYMENT_RECEIVED,
	PRE_APPROVAL_PENDING: QuotePipelineStatus.PRE_APPROVAL,
	PRE_APPROVAL_APPROVED: QuotePipelineStatus.PRE_APPROVAL,
	GRID_CONNECTION_PENDING: QuotePipelineStatus.GRID_PROCESS,
	GRID_CONNECTION_COMPLETED: QuotePipelineStatus.GRID_PROCESS,
	REBATE_CLAIM_PENDING: QuotePipelineStatus.REBATE_CLAIM_SUBMIT,
	REBATE_SUBMITTED: QuotePipelineStatus.REBATE_CLAIM_SUBMIT,
};

export function getPipelineRank(status?: string | null): number {
	if (!status) return -1;
	if (status === QuotePipelineStatus.DECLINED_CANCELLED) return -2;
	const normalized = normalizePipelineStatus(status);
	return QUOTE_PIPELINE_ORDER.indexOf(normalized as QuotePipelineStatus);
}

export function normalizePipelineStatus(status?: string | null): QuotePipelineStatus | null {
	if (!status) return null;
	const s = String(status).toUpperCase().trim();
	if (LEGACY_KANBAN_TO_PIPELINE[s]) return LEGACY_KANBAN_TO_PIPELINE[s];
	if ((ALL_PIPELINE_STATUSES as string[]).includes(s)) return s as QuotePipelineStatus;
	return null;
}

export function isValidPipelineStatus(status?: string | null): boolean {
	return normalizePipelineStatus(status) != null;
}
