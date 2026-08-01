import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

/**
 * Manual installer invoices/payments for Finance → Accounts.
 * Separate from quote-linked stock orders and other accounts modules.
 */
const AccountsInstallerInvoiceSchema = new Schema(
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

		/** Installer person + company */
		installer_name: { type: String, required: true },
		installer_company: { type: String, default: "" },
		installer_email: { type: String, default: "" },
		installer_phone: { type: String, default: "" },
		installer_address: { type: String, default: "" },
		installer_abn: { type: String, default: "" },
		installer_license: { type: String, default: "" },

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
	collectionOptions("accounts_installer_invoices"),
);

applyBasePlugins(AccountsInstallerInvoiceSchema, { collection: "accounts_installer_invoices", paranoid: true });

const AccountsInstallerInvoice =
	mongoose.models.AccountsInstallerInvoice ??
	mongoose.model("AccountsInstallerInvoice", AccountsInstallerInvoiceSchema);

export default AccountsInstallerInvoice;
