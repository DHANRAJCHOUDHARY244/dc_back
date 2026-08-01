import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

/**
 * Manual supplier stock invoices for Finance → Accounts.
 * Separate from quote-linked stock orders (collection: stocks).
 */
const AccountsStockInvoiceSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		invoice_number: { type: String, required: true, index: true },
		invoice_date: { type: Date, required: true },
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

		supplier_name: { type: String, required: true },
		supplier_company: { type: String, default: "" },
		supplier_email: { type: String, default: "" },
		supplier_phone: { type: String, default: "" },
		supplier_address: { type: String, default: "" },
		supplier_abn: { type: String, default: "" },

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
	collectionOptions("accounts_stock_invoices"),
);

applyBasePlugins(AccountsStockInvoiceSchema, { collection: "accounts_stock_invoices", paranoid: true });

const AccountsStockInvoice =
	mongoose.models.AccountsStockInvoice ??
	mongoose.model("AccountsStockInvoice", AccountsStockInvoiceSchema);

export default AccountsStockInvoice;
