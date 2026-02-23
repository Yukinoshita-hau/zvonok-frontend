import type { Middleware } from "@reduxjs/toolkit";
import { Client, type StompSubscription } from "@stomp/stompjs";
import type { Actions } from "../interfaces/actions.interface";
import { websocketActions } from "../slices/websocket.slice";
import { createWebSocketClient } from "../../services/websocket.service";
import { messageActions } from "../slices/message.slice";
import { WS_MESSAGES_PATH, WS_SEND_MESSAGE_PATH } from "../interfaces/wsPathes";


export const websocketMiddleware: Middleware = (storeApi) => {
	let client: Client | null = null;
	let subscriptions: Record<string, StompSubscription> = {};

	return (next) => (action) => {
		const myAction = action as any as Actions;
		switch (myAction.type) {
			case "websocket/connectStart":
				if (client?.active) {
					console.log("WS: Already active or connecting");
					return;
				}

				const token = storeApi.getState().user.accessToken;

				if (!token) {
					storeApi.dispatch(websocketActions.connectError("No token available"));
					return;
				}

				client = createWebSocketClient(token);

				client.onConnect = (frame) => {
					console.log("CONNECTED:", frame.command);


					const personalSub = client?.subscribe(WS_MESSAGES_PATH, (message) => {
						const data = JSON.parse(message.body);
						console.log(data)
						storeApi.dispatch(messageActions.addMessage(data))
					});

					if (personalSub) subscriptions[WS_MESSAGES_PATH] = personalSub;
				};

				storeApi.dispatch(websocketActions.connectSuccess());
				client.activate();
				break;
			case "message/sendMessage":
				if (!client?.active) {
					console.log("WS: Websocket is not active");
					return;
				}

				client.publish({
					destination: `${WS_SEND_MESSAGE_PATH}/${myAction.payload.roomId}`,
					body: myAction.payload.content,
				})
				break;
		}
		return next(action);
	}

}
