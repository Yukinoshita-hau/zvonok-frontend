const USER_QUEUE_PREFIX = "/user/queue";
const APP_CHAT_PREFIX = "/app/chat";
const APP_CALL_PREFIX = "/app/call";

export const WS_MESSAGES_PATH = `${USER_QUEUE_PREFIX}/messages`;
export const WS_CALL_PATH = `${USER_QUEUE_PREFIX}/call`;

export const WS_SEND_MESSAGE_PATH = `${APP_CHAT_PREFIX}/send`;
export const WS_SEND_PRIVATE_MESSAGE_PATH = `${APP_CHAT_PREFIX}/private`
export const WS_EDIT_MESSAGE_PATH = `${APP_CHAT_PREFIX}/edit`;
export const WS_DELETE_MESSAGE_PATH = `${APP_CHAT_PREFIX}/delete`;

export const WS_SEND_INVITE_PATH = `${APP_CALL_PREFIX}/invite`;
export const WS_SEND_ACCEPT_PATH = `${APP_CALL_PREFIX}/accept`;
