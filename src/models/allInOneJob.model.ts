import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray, jsonObject } from "@db/plugins";

/**
 * Pre Approval + Grid Assessment — internal staff Job package (loose-coupled).
 * Not related to customer Assessment form or Accounts PA/GC billing.
 */
const AllInOneJobSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		job_number: { type: String, required: true, unique: true, index: true },

		customer_id: { type: Number, index: true },
		customer: jsonObject,

		quote_source: {
			type: String,
			enum: ["CRM", "EXTERNAL", "NONE"],
			default: "NONE",
		},
		quote_ref: { type: String, default: "", index: true },
		quote_id: { type: Number },

		invoice_source: {
			type: String,
			enum: ["CRM", "EXTERNAL", "NONE"],
			default: "NONE",
		},
		invoice_ref: { type: String, default: "", index: true },
		invoice_id: { type: Number },
		/** CRM invoice kind when invoice_source is CRM */
		invoice_kind: {
			type: String,
			enum: ["DEFAULT", "CUSTOM", ""],
			default: "",
		},

		installation: jsonObject,
		pre_approval: jsonObject,
		grid_connection: jsonObject,

		/** { url, name, mime, size, category, uploaded_at, uploaded_by } */
		documents: jsonArray,
		photos: jsonArray,
		pdf_versions: jsonArray,
		whatsapp_sends: jsonArray,
		whatsapp_numbers: jsonArray,
		timeline: jsonArray,

		overall_status: {
			type: String,
			default: "OPEN",
			enum: [
				"OPEN",
				"IN_PROGRESS",
				"ASSESSMENT_DONE",
				"PA_PENDING",
				"PA_APPROVED",
				"GRID_PENDING",
				"COMPLETED",
				"ON_HOLD",
			],
			index: true,
		},

		created_by: { type: Number },
		updated_by: { type: Number },
	},
	collectionOptions("all_in_one_jobs"),
);

applyBasePlugins(AllInOneJobSchema, { collection: "all_in_one_jobs", paranoid: true });

const AllInOneJob =
	mongoose.models.AllInOneJob ?? mongoose.model("AllInOneJob", AllInOneJobSchema);

export default AllInOneJob;
