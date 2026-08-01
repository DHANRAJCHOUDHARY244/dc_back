import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

/**
 * Manual sales commission records for Finance → Accounts.
 * Separate from payment-history commissions and COMISSION expenses.
 *
 * commission_type: FIXED | PERCENTAGE
 */
const AccountsSalesCommissionSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		reference_number: { type: String, default: "", index: true },
		sales_person_name: { type: String, required: true, index: true },
		sales_person_email: { type: String, default: "" },
		sales_person_phone: { type: String, default: "" },

		customer_name: { type: String, default: "" },
		customer_email: { type: String, default: "" },
		customer_phone: { type: String, default: "" },
		customer_address: { type: String, default: "" },
		customer_company: { type: String, default: "" },

		/** FIXED or PERCENTAGE */
		commission_type: {
			type: String,
			required: true,
			default: "FIXED",
			enum: ["FIXED", "PERCENTAGE"],
			index: true,
		},
		/** Used when commission_type = PERCENTAGE */
		percentage_rate: { type: Number, default: 0 },
		/** Job / sale value used for percentage calc */
		job_value: { type: Number, default: 0 },
		/** Final commission amount */
		amount: { type: Number, required: true, default: 0 },
		currency: { type: String, default: "AUD" },

		job_installation_date: { type: Date },
		record_date: { type: Date, required: true },

		status: {
			type: String,
			default: "UNPAID",
			enum: ["PAID", "UNPAID"],
			index: true,
		},
		paid_date: { type: Date },
		notes: { type: String, default: "" },
		quotation_number: { type: String, default: "" },

		attachments: jsonArray,

		created_by: { type: Number },
		updated_by: { type: Number },
	},
	collectionOptions("accounts_sales_commissions"),
);

applyBasePlugins(AccountsSalesCommissionSchema, {
	collection: "accounts_sales_commissions",
	paranoid: true,
});

const AccountsSalesCommission =
	mongoose.models.AccountsSalesCommission ??
	mongoose.model("AccountsSalesCommission", AccountsSalesCommissionSchema);

export default AccountsSalesCommission;
