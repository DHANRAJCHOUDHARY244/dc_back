/** Quote pipeline statuses (stored in Quote.kanban_status).
 * Excluded: Stock Ordered, Invoice/Payment, Pre-Approval, Grid Connection.
 */

export enum QuotePipelineStatus {
	DRAFT = "DRAFT",
	PENDING = "PENDING",
	ACCEPTED = "ACCEPTED",
	DECLINED_CANCELLED = "DECLINED_CANCELLED",
	INSTALLATION_SCHEDULED = "INSTALLATION_SCHEDULED",
	INSTALLATION_IN_PROGRESS = "INSTALLATION_IN_PROGRESS",
	INSTALLATION_COMPLETED = "INSTALLATION_COMPLETED",
	REBATE_CLAIM_PENDING = "REBATE_CLAIM_PENDING",
	REBATE_SUBMITTED = "REBATE_SUBMITTED",
	REBATE_RECEIVED = "REBATE_RECEIVED",
	JOB_CLOSED = "JOB_CLOSED",
}

/** Ordered ranks for forward-only auto-advance (DECLINED_CANCELLED is terminal side-path). */
export const QUOTE_PIPELINE_ORDER: QuotePipelineStatus[] = [
	QuotePipelineStatus.DRAFT,
	QuotePipelineStatus.PENDING,
	QuotePipelineStatus.ACCEPTED,
	QuotePipelineStatus.INSTALLATION_SCHEDULED,
	QuotePipelineStatus.INSTALLATION_IN_PROGRESS,
	QuotePipelineStatus.INSTALLATION_COMPLETED,
	QuotePipelineStatus.REBATE_CLAIM_PENDING,
	QuotePipelineStatus.REBATE_SUBMITTED,
	QuotePipelineStatus.REBATE_RECEIVED,
	QuotePipelineStatus.JOB_CLOSED,
];

export const QUOTE_PIPELINE_LABELS: Record<QuotePipelineStatus, string> = {
	[QuotePipelineStatus.DRAFT]: "Draft Quotes",
	[QuotePipelineStatus.PENDING]: "Pending Quotes",
	[QuotePipelineStatus.ACCEPTED]: "Accepted Quotes",
	[QuotePipelineStatus.DECLINED_CANCELLED]: "Declined / Cancelled Quotes",
	[QuotePipelineStatus.INSTALLATION_SCHEDULED]: "Installation Scheduled",
	[QuotePipelineStatus.INSTALLATION_IN_PROGRESS]: "Installation In Progress",
	[QuotePipelineStatus.INSTALLATION_COMPLETED]: "Installation Completed",
	[QuotePipelineStatus.REBATE_CLAIM_PENDING]: "Rebate Claim Pending",
	[QuotePipelineStatus.REBATE_SUBMITTED]: "Rebate Submitted",
	[QuotePipelineStatus.REBATE_RECEIVED]: "Rebate Received",
	[QuotePipelineStatus.JOB_CLOSED]: "Job Closed",
};

/** Short labels for chips / kanban columns */
export const QUOTE_PIPELINE_SHORT_LABELS: Record<QuotePipelineStatus, string> = {
	[QuotePipelineStatus.DRAFT]: "Draft",
	[QuotePipelineStatus.PENDING]: "Pending",
	[QuotePipelineStatus.ACCEPTED]: "Accepted",
	[QuotePipelineStatus.DECLINED_CANCELLED]: "Declined / Cancelled",
	[QuotePipelineStatus.INSTALLATION_SCHEDULED]: "Install Scheduled",
	[QuotePipelineStatus.INSTALLATION_IN_PROGRESS]: "Install In Progress",
	[QuotePipelineStatus.INSTALLATION_COMPLETED]: "Install Completed",
	[QuotePipelineStatus.REBATE_CLAIM_PENDING]: "Rebate Claim Pending",
	[QuotePipelineStatus.REBATE_SUBMITTED]: "Rebate Submitted",
	[QuotePipelineStatus.REBATE_RECEIVED]: "Rebate Received",
	[QuotePipelineStatus.JOB_CLOSED]: "Job Closed",
};

export const ALL_PIPELINE_STATUSES = Object.values(QuotePipelineStatus);

/** Legacy kanban values → new pipeline */
export const LEGACY_KANBAN_TO_PIPELINE: Record<string, QuotePipelineStatus> = {
	PENDING: QuotePipelineStatus.PENDING,
	ACCEPTED: QuotePipelineStatus.ACCEPTED,
	SCHEDULED: QuotePipelineStatus.INSTALLATION_SCHEDULED,
	INSTALLED: QuotePipelineStatus.INSTALLATION_COMPLETED,
	INVOICE_GENERATED: QuotePipelineStatus.INSTALLATION_COMPLETED,
	PAYMENT_PENDING: QuotePipelineStatus.INSTALLATION_COMPLETED,
	PAYMENT_COMPLETED: QuotePipelineStatus.INSTALLATION_COMPLETED,
	PRE_APPROVAL_PENDING: QuotePipelineStatus.INSTALLATION_COMPLETED,
	PRE_APPROVAL_APPROVED: QuotePipelineStatus.INSTALLATION_COMPLETED,
	GRID_CONNECTION_PENDING: QuotePipelineStatus.INSTALLATION_COMPLETED,
	GRID_CONNECTION_COMPLETED: QuotePipelineStatus.INSTALLATION_COMPLETED,
};

export function getPipelineRank(status?: string | null): number {
	if (!status) return -1;
	if (status === QuotePipelineStatus.DECLINED_CANCELLED) return -2;
	const normalized = normalizePipelineStatus(status);
	return QUOTE_PIPELINE_ORDER.indexOf(normalized as QuotePipelineStatus);
}

/** Accept legacy + new status strings; return canonical pipeline status or null if unknown. */
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
