/**
 * One-shot migration: remap legacy kanban_status + align declined from customer_accepted.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/migrateQuotePipelineStatuses.ts
 */
import { connectDatabase, disconnectDatabase } from "@config/database";
import { QuoteCustomerStatus } from "@constants/common.enum";
import { QuotePipelineStatus } from "@constants/quotePipeline.constants";
import { quoteRepository } from "@repositories";

async function main() {
	await connectDatabase();
	console.log("Migrating quote pipeline statuses...");

	const remaps: Array<{ from: string; to: string }> = [
		{ from: "SCHEDULED", to: QuotePipelineStatus.INSTALLATION_SCHEDULED },
		{ from: "INSTALLED", to: QuotePipelineStatus.INSTALLATION_COMPLETED },
		{ from: "INVOICE_GENERATED", to: QuotePipelineStatus.INSTALLATION_COMPLETED },
		{ from: "PAYMENT_PENDING", to: QuotePipelineStatus.INSTALLATION_COMPLETED },
		{ from: "PAYMENT_COMPLETED", to: QuotePipelineStatus.INSTALLATION_COMPLETED },
		{ from: "PRE_APPROVAL_PENDING", to: QuotePipelineStatus.INSTALLATION_COMPLETED },
		{ from: "PRE_APPROVAL_APPROVED", to: QuotePipelineStatus.INSTALLATION_COMPLETED },
		{ from: "GRID_CONNECTION_PENDING", to: QuotePipelineStatus.INSTALLATION_COMPLETED },
		{ from: "GRID_CONNECTION_COMPLETED", to: QuotePipelineStatus.INSTALLATION_COMPLETED },
	];

	for (const { from, to } of remaps) {
		const r = await quoteRepository.updateMany({ kanban_status: from }, { $set: { kanban_status: to } });
		console.log(`  ${from} → ${to}: ${r.modifiedCount ?? 0}`);
	}

	const declined = await quoteRepository.updateMany(
		{
			customer_accepted: {
				$in: [QuoteCustomerStatus.REJECTED, QuoteCustomerStatus.EXPIRED, QuoteCustomerStatus.DEAD],
			},
			kanban_status: { $nin: [QuotePipelineStatus.DECLINED_CANCELLED, QuotePipelineStatus.JOB_CLOSED] },
		},
		{ $set: { kanban_status: QuotePipelineStatus.DECLINED_CANCELLED, status_updated_date: new Date() } },
	);
	console.log(`  declined from customer_accepted: ${declined.modifiedCount ?? 0}`);

	// Best-effort: accepted quotes that still sit on PENDING → ACCEPTED
	const acceptedPending = await quoteRepository.updateMany(
		{
			customer_accepted: QuoteCustomerStatus.ACCEPTED,
			kanban_status: QuotePipelineStatus.PENDING,
		},
		{ $set: { kanban_status: QuotePipelineStatus.ACCEPTED } },
	);
	console.log(`  ACCEPTED customer still PENDING pipeline → ACCEPTED: ${acceptedPending.modifiedCount ?? 0}`);

	console.log("Done.");
	await disconnectDatabase();
}

main().catch(async (err) => {
	console.error(err);
	try {
		await disconnectDatabase();
	} catch {
		/* ignore */
	}
	process.exit(1);
});
