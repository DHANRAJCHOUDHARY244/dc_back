import { hasAdminPermission } from "@services/adminPermission.service";
import { Roles } from "src/data/dataInserter";

const ADMIN_ROLES = new Set([
  Roles.SUPER_ADMIN,
  Roles.ADMIN,
  Roles.CEO,
  Roles.MANAGER,
  Roles.OPERATIONS_MANAGER,
]);

export type TaskAccess = {
  scope: "admin" | "self";
  is_admin: boolean;
  user_id: number;
};

export function isTaskAdminRole(role?: string | null) {
  return !!role && ADMIN_ROLES.has(role);
}

export async function getTaskAccess(user: {
  id?: number;
  role?: string;
  role_id?: number;
}): Promise<TaskAccess> {
  const role = String(user?.role || "");
  const flaggedAdmin = await hasAdminPermission(user, ["Tasks", "Master Tasks"]).catch(() => false);
  if (isTaskAdminRole(role) || flaggedAdmin) {
    return { scope: "admin", is_admin: true, user_id: Number(user.id) };
  }
  return { scope: "self", is_admin: false, user_id: Number(user.id) };
}

export function applyTaskScope(
  filter: Record<string, unknown>,
  access: TaskAccess,
  assigneeField = "assignee_id",
) {
  if (access.scope === "admin") return filter;
  filter[assigneeField] = access.user_id;
  return filter;
}

export function assertTaskAccess(
  access: TaskAccess,
  task: { assignee_id?: number; created_by?: number },
) {
  if (access.is_admin) return true;
  const uid = access.user_id;
  return task.assignee_id === uid || task.created_by === uid;
}
