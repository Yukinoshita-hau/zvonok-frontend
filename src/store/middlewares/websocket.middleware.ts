import type { Middleware } from "@reduxjs/toolkit";
import { Client, type StompSubscription } from "@stomp/stompjs";
import type { Actions } from "../interfaces/actions.interface";
import { websocketActions } from "../slices/websocket.slice";
import { createWebSocketClient } from "../../services/websocket.service";
import { fetchRoomMessages, messageActions } from "../slices/message.slice";
import { WS_CALL_PATH, WS_DELETE_MESSAGE_PATH, WS_EDIT_MESSAGE_PATH, WS_MESSAGES_PATH, WS_SEND_ACCEPT_PATH, WS_SEND_INVITE_PATH, WS_SEND_MESSAGE_PATH, WS_SEND_PRIVATE_MESSAGE_PATH } from "../interfaces/wsPathes";
import { fetchMyRooms } from "../slices/room.slice";
import type { BaseCallEvent, CallInviteEvent } from "../interfaces/callEvents.interface";
import { callActions, getToken } from "../slices/call.clice";
import type { AppDispatch, RootState } from "../interfaces/rootState.interface";


export const websocketMiddleware: Middleware<{}, RootState, AppDispatch> = (storeApi) => {
	let client: Client | null = null;
	let subscriptions: Record<string, StompSubscription> = {};

	return (next) => (action) => {
		const myAction = action as any as Actions;
		switch (myAction.type) {
			case "websocket/connectStart": {

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
					storeApi.dispatch(websocketActions.connectSuccess());

					const personalSub = client?.subscribe(WS_MESSAGES_PATH, (message) => {

						const data = JSON.parse(message.body);
						const state = storeApi.getState();
						const pending = state.message.pendingPrivateUsername;
						const activeRoomId = state.message.activeRoomId;

						if (!activeRoomId && pending && data.room?.id
							&& data.sender?.username === state.user.myUser?.username) {
							storeApi.dispatch(messageActions.setActiveRoom(data.room.id));
							storeApi.dispatch(messageActions.setPendingPrivate(null));
							storeApi.dispatch(fetchRoomMessages({ roomId: data.room.id }))
						}

						storeApi.dispatch(messageActions.execEventMessage(data))
						storeApi.dispatch(fetchMyRooms());
					});

					if (personalSub) subscriptions[WS_MESSAGES_PATH] = personalSub;

					const callSub = client?.subscribe(WS_CALL_PATH, (message) => {
						const data = JSON.parse(message.body) as BaseCallEvent;

						switch (data.type) {
							case "CALL_INVITE": {
								storeApi.dispatch(callActions.incomingInvite(data as CallInviteEvent));
								break;
							}

							case "CALL_ACCEPT": {
								const roomName = storeApi.getState().call.livekitRoomName;
								if (!roomName) break;

								storeApi.dispatch(getToken(roomName))
								break;
							}
							// TODO: добавить Decline и End
						}
					})

					if (callSub) subscriptions[WS_CALL_PATH] = callSub;
				};

				client.activate();
				break;
			}
			case "message/sendMessage": {
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
			case "message/sendPrivateMessage": {
				if (!client?.active) {
					console.log("WS: Websocket is not active");
					return;
				}

				client.publish({
					destination: `${WS_SEND_PRIVATE_MESSAGE_PATH}/${myAction.payload.receiver}`,
					body: myAction.payload.content,
				})
				break;
			}
			case "message/editMessage": {
				if (!client?.active) {
					console.log("WS: Websocket is not active");
					return;
				}

				client.publish({
					destination: `${WS_EDIT_MESSAGE_PATH}/${myAction.payload.messageId}`,
					body: myAction.payload.newContent,
				});
				break;
			}

			case "message/deleteMessage": {
				if (!client?.active) {
					console.log("WS: Websocket is not active");
					return;
				}

				client.publish({
					destination: `${WS_DELETE_MESSAGE_PATH}/${myAction.payload.messageId}`,
				});

				break;
			}

			case "call/sendInvite": {
				if (!client?.active) {
					console.log("WS: Websocket is not active");
					return;
				}

				client?.publish({
					destination: WS_SEND_INVITE_PATH,
					body: JSON.stringify({
						chatRoomId: myAction.payload.chatRoomId,
						callType: myAction.payload.callType
					})
				})
				break;
			}

			case "call/sendAccept": {
				if (!client?.active) {
					console.log("WS: Websocket is not active");
					return;
				}

				client?.publish({
					destination: WS_SEND_ACCEPT_PATH,
					body: JSON.stringify({
						chatRoomId: myAction.payload.chatRoomId,
						callerUsername: myAction.payload.callerUsername
					})
				})
				break;
			}
		}
		return next(action);
	}

}

