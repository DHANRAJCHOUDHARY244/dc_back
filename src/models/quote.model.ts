import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const QuoteSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    customer_id: { type: Number, index: true },
    cf_id: { type: Number },
    sender_id: { type: Number, index: true },
    currency: { type: String, required: true },
    dateOfDue: { type: Date, required: true },
    notes: { type: String, required: false, default: "" },
    subTotal: { type: Number, required: true },
    customer_accepted: {
      type: String,
      default: "PENDING",
      enum: ["ACCEPTED", "PENDING", "REJECTED", "EXPIRED", "DEAD"],
    },
    address: { type: String },
    mobile_no: { type: String },
    name: { type: String, required: true },
    reason: { type: String },
    customerSignatureUrl: { type: String },
    bypass_token: { type: String },
    taxRate: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    discountAmount: { type: Number, required: true },
    discountRate: { type: Number, required: true },
    /** rate = %; amount = fixed $. Legacy quotes default to rate. */
    discountMode: {
      type: String,
      enum: ["rate", "amount"],
      default: "rate",
    },
    total: { type: Number, required: true },
    loan_enabled: { type: Boolean, required: true, default: false },
    loan_meta: { type: Schema.Types.Mixed },
    items: jsonArray,
    last_follow_up_date_time: { type: Date },
    follow_up_count: { type: Number, default: 0 },
    follow_up_history: jsonArray,
    accepted_date: { type: Date },
    signed_date: { type: Date },
    status_updated_date: { type: Date },
    /** Date tied to current pipeline stage (e.g. scheduled install date). */
    pipeline_status_date: { type: Date },
    /** Notes for the current pipeline stage update. */
    pipeline_notes: { type: String, default: "" },
    quote_close_date: { type: Date },
    kanban_status: {
      type: String,
      default: "PENDING",
      enum: [
        "DRAFT",
        "PENDING",
        "ACCEPTED",
        "DECLINED_CANCELLED",
        "STOCK_ORDERED",
        "STOCK_DELIVERED",
        "INSTALLATION_SCHEDULED",
        "PRE_APPROVAL",
        "INSTALLATION_IN_PROGRESS",
        "INSTALLATION_COMPLETED",
        "GRID_PROCESS",
        "CX_PAYMENT_PENDING",
        "CX_PAYMENT_RECEIVED",
        "REBATE_CLAIM_SUBMIT",
        "REBATE_RECEIVED",
        "FEEDBACK_REFERRAL",
        "JOB_CLOSED",
        // legacy / previous pipeline values
        "REBATE_CLAIM_PENDING",
        "REBATE_SUBMITTED",
        "SCHEDULED",
        "INSTALLED",
        "INVOICE_GENERATED",
        "PAYMENT_PENDING",
        "PAYMENT_COMPLETED",
        "PRE_APPROVAL_PENDING",
        "PRE_APPROVAL_APPROVED",
        "GRID_CONNECTION_PENDING",
        "GRID_CONNECTION_COMPLETED",
      ],
      index: true,
    },
    /** Audit trail for pipeline advances */
    pipeline_history: jsonArray,
    /** Manual stage details (stock ordered/delivered, pre-approval, grid, payment, rebate, etc.) — not StockOrder module */
    pipeline_stage_details: { type: Schema.Types.Mixed, default: {} },
    /** Customer install booking details (date/time/installer credentials). */
    installation_schedule: { type: Schema.Types.Mixed, default: null },
    /** Project cancellation details + email audit. */
    cancellation_details: { type: Schema.Types.Mixed, default: null },
    assessment_id: { type: Number },
    progress: jsonArray,
    distance: { type: Number },
    manual_attachments: jsonArray,
    /** Solar Sketch / Green Sketch layout state (panels, markers, model, coords). */
    green_sketch: { type: Schema.Types.Mixed, default: null },
    /** True when this quote is a standalone Solar Sketch solar quote (kept out of the normal quote lists). */
    is_solar_sketch: { type: Boolean, default: false, index: true },
    /** Site / install options */
    installationType: { type: String },
    property_type: { type: String },
    state: { type: String },
    panelRemoval: { type: Boolean, default: false },
    criticalInstallation: { type: Boolean, default: false },
    garageInstallation: { type: Boolean, default: false },
    extraWiring: { type: Boolean, default: false },
    extraWiringMeters: { type: Number, default: 0 },
    boardUpgrade: { type: Boolean, default: false },
    miniSubboardRequired: { type: Boolean, default: false },
    /** Virtual Power Plant participation */
    vpp: { type: Boolean, default: false },
    vppProvider: { type: String, default: "" },
    postcode: { type: String, default: "" },
    customer_type: { type: String, default: "" },
    occupancy: { type: String, default: "" },
    installationDate: { type: String, default: "" },
    waNetwork: { type: String, default: "" },
    solarVicRebate: { type: Boolean, default: false },
    solarVicLoan: { type: Boolean, default: false },
    solarVicEligibleConfirmed: { type: Boolean, default: false },
    vicHotWaterRebate: { type: Boolean, default: false },
    vicHotWaterLocalManufactured: { type: Boolean, default: false },
    waBatteryRebateConfirmed: { type: Boolean, default: false },
    waInterestFreeLoan: { type: Boolean, default: false },
    existingSolar: { type: Boolean, default: false },
    batteryInstallType: { type: String, default: "" },
    rebateAmount: { type: Number, default: 0 },
  },
  collectionOptions("quotes"),
);

QuoteSchema.virtual("customer", { ref: "User", localField: "customer_id", foreignField: "id", justOne: true });
QuoteSchema.virtual("sender", { ref: "User", localField: "sender_id", foreignField: "id", justOne: true });
QuoteSchema.virtual("cf", { ref: "ContactForm", localField: "cf_id", foreignField: "id", justOne: true });
QuoteSchema.virtual("assessment", { ref: "Assessment", localField: "assessment_id", foreignField: "id", justOne: true });

applyBasePlugins(QuoteSchema, { collection: "quotes", paranoid: true });

const Quote = mongoose.models.Quote ?? mongoose.model("Quote", QuoteSchema);
export default Quote;
