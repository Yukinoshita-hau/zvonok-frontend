interface WsConnectAction {
	type: "websocket/connectStart";
}

interface SendMessageAction {
	type: "message/sendMessage";
	payload: { roomId: string, content: string };
}

interface SendPrivateMessageAction {
	type: "message/sendPrivateMessage";
	payload: { receiver: string, content: string }
}

interface EditMessageAction {
	type: "message/editMessage";
	payload: { messageId: number, newContent: string };
}

interface DeleteMessageAction {
	type: "message/deleteMessage";
	payload: { messageId: number };
}

export type Actions = WsConnectAction | SendMessageAction | SendPrivateMessageAction | EditMessageAction | DeleteMessageAction;
