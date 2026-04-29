const USER_QUEUE_PREFIX = "/user/queue";
const APP_CHAT_PREFIX = "/app/chat";
const APP_CALL_PREFIX = "/app/call";
const APP_FRIEND_REQUESTS_PREFIX = "/app/friend";

export const WS_MESSAGES_PATH = `${USER_QUEUE_PREFIX}/messages`;
export const WS_CALL_PATH = `${USER_QUEUE_PREFIX}/call`;
export const WS_FRIEND_REQUESTS_PATH = `${USER_QUEUE_PREFIX}/friend-requests`;
export const WS_ERROR_PATH = `${USER_QUEUE_PREFIX}/errors`;
export const WS_MESSAGE_READ_PATH = `${USER_QUEUE_PREFIX}/message-read`;
export const WS_ROOM_EVENTS_PATH = `${USER_QUEUE_PREFIX}/room-events`;
export const WS_USER_EVENTS_PATH = `${USER_QUEUE_PREFIX}/users`;

export const WS_SEND_MESSAGE_PATH = `${APP_CHAT_PREFIX}/send`;
export const WS_SEND_PRIVATE_MESSAGE_PATH = `${APP_CHAT_PREFIX}/private`
export const WS_SEND_CHANNEL_MESSAGE_PATH = `${APP_CHAT_PREFIX}/channel`
export const WS_EDIT_MESSAGE_PATH = `${APP_CHAT_PREFIX}/edit`;
export const WS_DELETE_MESSAGE_PATH = `${APP_CHAT_PREFIX}/delete`;
export const WS_UPDATE_READ_MESSAGE_PATH = `${APP_CHAT_PREFIX}/read`;

export const WS_SEND_INVITE_PATH = `${APP_CALL_PREFIX}/invite`;
export const WS_SEND_ACCEPT_PATH = `${APP_CALL_PREFIX}/accept`;
export const WS_SEND_DECLINE_PATH = `${APP_CALL_PREFIX}/decline`;
export const WS_SEND_LEAVE_PATH = `${APP_CALL_PREFIX}/leave`;
export const WS_SEND_END_PATH = `${APP_CALL_PREFIX}/end`;

export const WS_SEND_FRIEND_REQUEST_PATH = `${APP_FRIEND_REQUESTS_PREFIX}/send`;
export const WS_ACCEPT_FRIEND_REQUEST_PATH = `${APP_FRIEND_REQUESTS_PREFIX}/accept`;
export const WS_REJECT_FRIEND_REQUEST_PATH = `${APP_FRIEND_REQUESTS_PREFIX}/reject`;
export const WS_CANCEL_FRIEND_REQUEST_PATH = `${APP_FRIEND_REQUESTS_PREFIX}/cancel`;
export const WS_REMOVE_FRIEND_REQUEST_PATH = `${APP_FRIEND_REQUESTS_PREFIX}/remove`;
