import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

/**
 * Manual rebate records for Finance → Accounts.
 * One rebate can contain multiple line items (STC, BSTC, Solar Victoria,
 * Interest Free Loan, Instant Rebate with categories).
 */
const AccountsRebateSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		reference_number: { type: String, required: true, index: true },
		rebate_date: { type: Date, required: true },
		/** Sum of all line item amounts */
		amount: { type: Number, required: true, default: 0 },
		currency: { type: String, default: "AUD" },
		status: {
			type: String,
			default: "UNPAID",
			enum: ["PAID", "UNPAID"],
			index: true,
		},
		paid_date: { type: Date },
		notes: { type: String, default: "" },

		/**
		 * Multiple rebate lines in one record.
		 * Each: { scheme, category?, quantity?, unit_price?, amount, notes? }
		 */
		items: jsonArray,

		/** Legacy single-line fields (kept for older rows; prefer items[]) */
		scheme: {
			type: String,
			default: "",
			enum: ["", "STC", "BSTC", "SOLAR_VICTORIA", "INTEREST_FREE_LOAN", "INSTANT_REBATE"],
			index: true,
		},
		category: {
			type: String,
			default: "",
			enum: [
				"",
				"SOLAR",
				"BATTERY",
				"AIRCON",
				"HEATPUMP",
				"VIC_HEATPUMP",
				"SOLAR_BATTERY_AIRCON",
				"VEECS",
			],
			index: true,
		},
		quantity: { type: Number, default: 0 },
		unit_price: { type: Number, default: 0 },

		customer_name: { type: String, default: "" },
		customer_email: { type: String, default: "" },
		customer_phone: { type: String, default: "" },
		customer_address: { type: String, default: "" },
		customer_company: { type: String, default: "" },

		attachments: jsonArray,

		created_by: { type: Number },
		updated_by: { type: Number },
	},
	collectionOptions("accounts_rebates"),
);

applyBasePlugins(AccountsRebateSchema, { collection: "accounts_rebates", paranoid: true });

const AccountsRebate =
	mongoose.models.AccountsRebate ?? mongoose.model("AccountsRebate", AccountsRebateSchema);

export default AccountsRebate;
