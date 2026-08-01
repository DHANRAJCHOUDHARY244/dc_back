import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

/**
 * Manual stock delivery records for Finance → Accounts.
 * Separate from quote-linked stock orders (collection: stocks) and supplier stock invoices.
 */
const AccountsStockDeliverySchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		delivery_number: { type: String, required: true, index: true },
		delivery_date: { type: Date, required: true },
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

		/** Delivery company + deliverer person */
		delivery_company: { type: String, required: true },
		deliverer_name: { type: String, default: "" },
		delivery_email: { type: String, default: "" },
		delivery_phone: { type: String, default: "" },
		delivery_address: { type: String, default: "" },
		delivery_abn: { type: String, default: "" },
		vehicle_name: { type: String, default: "" },
		vehicle_number: { type: String, default: "" },

		customer_name: { type: String, default: "" },
		customer_email: { type: String, default: "" },
		customer_phone: { type: String, default: "" },
		customer_address: { type: String, default: "" },
		customer_company: { type: String, default: "" },

		/** Photo / PDF attachments: { url, name, mime, size, uploaded_at } */
		attachments: jsonArray,

		created_by: { type: Number },
		updated_by: { type: Number },
	},
	collectionOptions("accounts_stock_deliveries"),
);

applyBasePlugins(AccountsStockDeliverySchema, { collection: "accounts_stock_deliveries", paranoid: true });

const AccountsStockDelivery =
	mongoose.models.AccountsStockDelivery ??
	mongoose.model("AccountsStockDelivery", AccountsStockDeliverySchema);

export default AccountsStockDelivery;
