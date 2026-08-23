import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const UserPermissionSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    user_id: { type: Number },
    permission_id: { type: Number, required: true },
    role_id: { type: Number, required: true, index: true },
    enable: { type: Boolean, required: true, default: false },
    create: { type: Boolean, required: true, default: false },
    delete: { type: Boolean, required: true, default: false },
    can_update: { type: Boolean, required: true, default: false },
    is_user_specific: { type: Boolean, required: true, default: false },
    is_admin: { type: Boolean, required: true, default: false },
  },
  collectionOptions("user_permissions"),
);

UserPermissionSchema.index({ role_id: 1, enable: 1 });

UserPermissionSchema.virtual("role", {
  ref: "Role",
  localField: "role_id",
  foreignField: "id",
  justOne: true,
});

UserPermissionSchema.virtual("permission", {
  ref: "Permission",
  localField: "permission_id",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(UserPermissionSchema, { collection: "user_permissions", paranoid: true });

const UserPermission =
  mongoose.models.UserPermission ?? mongoose.model("UserPermission", UserPermissionSchema);
export default UserPermission;
