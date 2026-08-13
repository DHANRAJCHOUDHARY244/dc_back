import {
  EVENT_TASK_TYPE,
  SOCKET_EVENTS,
  USER_NOTIFICATION_EVENT_TYPE,
} from "@constants/socket.constants";
import { SocketService } from "@services/socket.service";

export function roleRoom(roleId: number | string): string {
  return `${SOCKET_EVENTS.ROLE_ROOM_PREFIX}${roleId}`;
}

/** Notify all connected users with this role to refresh permissions (no logout). */
export function notifyRolePermissionChange(roleId: number | string): void {
  try {
    SocketService.emitToRoom(roleRoom(roleId), SOCKET_EVENTS.PERMISSION_UPDATED, {
      type: USER_NOTIFICATION_EVENT_TYPE.PERMISSION,
      task_type: EVENT_TASK_TYPE.UPDATED,
      role_id: Number(roleId),
      message: "Your permissions were updated. Menus will refresh automatically.",
    });
  } catch (err) {
    console.warn("permission notify skipped (socket not ready):", err);
  }
}
