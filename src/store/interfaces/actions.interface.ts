interface WsConnectAction {
	type: "websocket/connectStart";
}

interface SendMessageAction {
	type: "message/sendMessage";
	payload: { roomId: string, content: string };
}

export type Actions = WsConnectAction | SendMessageAction;
