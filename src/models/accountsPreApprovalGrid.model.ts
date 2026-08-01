import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

/**
 * Manual pre-approval / grid connection records for Finance → Accounts.
 * Separate from PRE_APPROVAL / GRID_CONNECTION expense entries.
 *
 * service_type: PRE_APPROVAL | GRID_CONNECTION | BOTH
 */
const AccountsPreApprovalGridSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		quotation_number: { type: String, required: true, index: true },
		record_date: { type: Date, required: true },
		amount: { type: Number, required: true, default: 0 },
		currency: { type: String, default: "AUD" },

		/** What this record covers */
		service_type: {
			type: String,
			required: true,
			default: "PRE_APPROVAL",
			enum: ["PRE_APPROVAL", "GRID_CONNECTION", "BOTH"],
			index: true,
		},

		status: {
			type: String,
			default: "UNPAID",
			enum: ["PAID", "UNPAID"],
			index: true,
		},
		paid_date: { type: Date },
		notes: { type: String, default: "" },

		/** Optional retailer / DNSP context */
		retailer: { type: String, default: "" },
		dnsp: { type: String, default: "" },
		nmi: { type: String, default: "" },
		reference_number: { type: String, default: "" },

		customer_name: { type: String, default: "" },
		customer_email: { type: String, default: "" },
		customer_phone: { type: String, default: "" },
		customer_address: { type: String, default: "" },
		customer_company: { type: String, default: "" },

		/** Photo / PDF attachments */
		attachments: jsonArray,

		created_by: { type: Number },
		updated_by: { type: Number },
	},
	collectionOptions("accounts_pre_approval_grid"),
);

applyBasePlugins(AccountsPreApprovalGridSchema, {
	collection: "accounts_pre_approval_grid",
	paranoid: true,
});

const AccountsPreApprovalGrid =
	mongoose.models.AccountsPreApprovalGrid ??
	mongoose.model("AccountsPreApprovalGrid", AccountsPreApprovalGridSchema);

export default AccountsPreApprovalGrid;
