import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const RoleSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    desc: { type: String, required: true },
    order: { type: Number },
  },
  collectionOptions("roles"),
);

applyBasePlugins(RoleSchema, { collection: "roles", paranoid: true });

const Role = mongoose.models.Role ?? mongoose.model("Role", RoleSchema);
export default Role;
