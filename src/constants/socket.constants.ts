export const SOCKET_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  MESSAGE: 'message',
  AUTH_FAILED: 'auth-failed',
  HANDSHAKE_SUCCESS: 'handshake-success',
  LOGIN:'login',
  USER_NOTIFICATION:'user-notification',
  /** Role-scoped room: `role-{roleId}` */
  ROLE_ROOM_PREFIX: 'role-',
  /** Broadcast when role permissions change — clients refresh menus without logout */
  PERMISSION_UPDATED: 'permission-updated',
  /* Quote Chat */
  QUOTE_CHAT_JOIN: 'quote-chat:join',
  QUOTE_CHAT_LEAVE: 'quote-chat:leave',
  QUOTE_CHAT_MESSAGE: 'quote-chat:message',
  QUOTE_CHAT_TYPING: 'quote-chat:typing',
  /* CRM Chat */
  CHAT_JOIN: 'chat:join',
  CHAT_LEAVE: 'chat:leave',
  CHAT_TYPING: 'chat:typing',
  CHAT_READ: 'chat:read',
  /** Live CRM staff presence */
  PRESENCE_SYNC: 'presence:sync',
  PRESENCE_UPDATE: 'presence:update',
  PRESENCE_REQUEST: 'presence:request',
  /** Header badge live refresh — clients refetch or apply payload */
  BADGE_MASTER_TASKS: 'badge:master-tasks',
  BADGE_SLA_DELAYS: 'badge:sla-delays',
};

export enum USER_NOTIFICATION_EVENT_TYPE{
  USER='USER',
  QUOTE='QUOTE',
  INVOICE='INVOICE',
  CUSTOM_INVOICE='CUSTOM_INVOICE',
  PERMISSION='PERMISSION',
  CHAT='CHAT',
}
export enum EVENT_TASK_TYPE{
  CREATED='CREATED',
  UPDATED='UPDATED',
  DELETED='DELETED',
  MENTION='MENTION',
  REPLY='REPLY',
}
export interface SocketDataInterface{
    type:USER_NOTIFICATION_EVENT_TYPE,
    time?:string;
    task_type?:EVENT_TASK_TYPE;
    profile_image?:string;
    name?:string;
    message:string;
}