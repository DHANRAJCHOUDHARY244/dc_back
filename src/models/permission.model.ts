import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const PermissionSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String, required: true },
    parentId: { type: Number },
    label: { type: String, required: true },
    icon: { type: String },
    type: { type: Number, required: true },
    route: { type: String, required: true },
    order: { type: Number },
    children: jsonArray,
    component: { type: String },
    newFeature: { type: Boolean },
    hide: { type: Boolean },
    status: { type: Number },
  },
  collectionOptions("permissions"),
);

applyBasePlugins(PermissionSchema, { collection: "permissions", paranoid: true });

const Permission = mongoose.models.Permission ?? mongoose.model("Permission", PermissionSchema);
export default Permission;
