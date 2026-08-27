import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";
import { OtpType } from "@constants/common.enum";

const defaultBankDetails = {
  bank_name: null,
  account_holder_name: null,
  account_number: null,
  ifsc_code: null,
  branch_name: null,
  account_type: null,
  is_verified: false,
};

const UserSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    username: { type: String, required: true, index: true },
    name: { type: String, required: true },
    address: { type: String },
    email: { type: String, required: true, index: true },
    city: { type: String },
    otp: {
      type: Schema.Types.Mixed,
      default: () => ({ otp: null, otp_type: OtpType.VERIFY_EMAIL, expired_at: null }),
    },
    password: { type: String, required: true },
    is_verified: { type: Boolean, default: false },
    /** When true, user must set a new password before using the app. */
    must_change_password: { type: Boolean, default: false },
    mobile_no: { type: String },
    mobile_country_code: { type: String },
    otp_verification_token: { type: String },
    is_active: { type: Boolean, default: true },
    role_id: { type: Number, index: true },
    profile_image: { type: String },
    bank_details: { type: Schema.Types.Mixed, default: () => ({ ...defaultBankDetails }) },
    active_crm_company_unit_id: { type: Number, default: null },
    default_crm_company_unit_id: { type: Number, default: null },
  },
  collectionOptions("users"),
);

UserSchema.virtual("role", {
  ref: "Role",
  localField: "role_id",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(UserSchema, { collection: "users", paranoid: true });

const User = mongoose.models.User ?? mongoose.model("User", UserSchema);
export default User;
