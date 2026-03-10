import type { Middleware } from "@reduxjs/toolkit";
import { Client, type StompSubscription } from "@stomp/stompjs";
import type { Actions } from "../interfaces/actions.interface";
import { websocketActions } from "../slices/websocket.slice";
import { createWebSocketClient } from "../../services/websocket.service";
import { fetchRoomMessages, messageActions } from "../slices/message.slice";
import { WS_ACCEPT_FRIEND_REQUEST_PATH, WS_CALL_PATH, WS_CANCEL_FRIEND_REQUEST_PATH, WS_DELETE_MESSAGE_PATH, WS_EDIT_MESSAGE_PATH, WS_ERROR_PATH, WS_FRIEND_REQUESTS_PATH, WS_MESSAGES_PATH, WS_REJECT_FRIEND_REQUEST_PATH, WS_REMOVE_FRIEND_REQUEST_PATH, WS_SEND_ACCEPT_PATH, WS_SEND_FRIEND_REQUEST_PATH, WS_SEND_INVITE_PATH, WS_SEND_MESSAGE_PATH, WS_SEND_PRIVATE_MESSAGE_PATH } from "../interfaces/wsPathes";
import { fetchMyRooms } from "../slices/room.slice";
import type { BaseCallEvent, CallInviteEvent } from "../interfaces/callEvents.interface";
import { callActions, getToken } from "../slices/call.clice";
import type { AppDispatch, RootState } from "../interfaces/rootState.interface";
import type { FriendEventMessage } from "../../api/interfaces/FriendEventMessage";
import { fetchIncomingRequests, fetchMyFriends, fetchOutgoingRequests } from "../slices/friend.slice";


export const websocketMiddleware: Middleware<{}, RootState, AppDispatch> = (storeApi) => {
	let client: Client | null = null;
	let subscriptions: Record<string, StompSubscription> = {};

	return (next) => (action) => {
		const myAction = action as any as Actions;


		switch (myAction.type) {
			case "websocket/connectStart": {

				const token = storeApi.getState().user.accessToken;

				if (!token) {
					storeApi.dispatch(websocketActions.connectError("No token available"));
					return;
				}

				client = createWebSocketClient(token);

				client.onConnect = (frame) => {
					console.log("CONNECTED:", frame.command);
					storeApi.dispatch(websocketActions.connectSuccess());

					const personalMessageSub = client?.subscribe(WS_MESSAGES_PATH, (message) => {

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

					if (personalMessageSub) subscriptions[WS_MESSAGES_PATH] = personalMessageSub;

					const personalCallSub = client?.subscribe(WS_CALL_PATH, (message) => {
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

					if (personalCallSub) subscriptions[WS_CALL_PATH] = personalCallSub;

					const personalFriendRequestSub = client?.subscribe(WS_FRIEND_REQUESTS_PATH, (message) => {
						const data = JSON.parse(message.body) as FriendEventMessage;
						console.log(data)

						const myUsername = storeApi.getState().user.myUser?.username;

						switch (data.type) {
							case "FRIEND_REQUEST_ACCEPTED": {
								if (data.payload?.senderUsername === myUsername) {
									storeApi.dispatch(fetchOutgoingRequests());
								} else if (data.payload?.receiverUsername === myUsername) {
									storeApi.dispatch(fetchIncomingRequests());
								}

								storeApi.dispatch(fetchMyFriends());

								break;
							}
							case "FRIEND_REQUEST_CREATED":
							case "FRIEND_REQUEST_REJECTED":
							case "FRIEND_REQUEST_CANCELLED": {
								if (data.payload?.senderUsername === myUsername) {
									storeApi.dispatch(fetchOutgoingRequests());
								} else if (data.payload?.receiverUsername === myUsername) {
									storeApi.dispatch(fetchIncomingRequests());
								}

								break;
							}
							case "FRIEND_DELETE": {
								storeApi.dispatch(fetchMyFriends());
							}
						}
					})

					if (personalFriendRequestSub) subscriptions[WS_FRIEND_REQUESTS_PATH] = personalFriendRequestSub;

					const errorSub = client?.subscribe(WS_ERROR_PATH, (message) => {
						const data = JSON.parse(message.body) as { message: string, status: number };

						console.log(data);
					})

					if (errorSub) subscriptions[WS_ERROR_PATH] = errorSub;
				};

				client.activate();
				break;
			}
			case "message/sendMessage": {
				if (!client?.active) {
					console.log("WS: Already active or connecting");
					return;
				}
				client?.publish({
					destination: `${WS_SEND_MESSAGE_PATH}/${myAction.payload.roomId}`,
					body: myAction.payload.content,
				})

				break;
			}
			case "message/sendPrivateMessage": {
				if (!client?.active) {
					console.log("WS: Already active or connecting");
					return;
				}
				client?.publish({
					destination: `${WS_SEND_PRIVATE_MESSAGE_PATH}/${myAction.payload.receiver}`,
					body: myAction.payload.content,
				})
				break;
			}
			case "message/editMessage": {
				if (!client?.active) {
					console.log("WS: Already active or connecting");
					return;
				}
				client?.publish({
					destination: `${WS_EDIT_MESSAGE_PATH}/${myAction.payload.messageId}`,
					body: myAction.payload.newContent,
				});
				break;
			}

			case "message/deleteMessage": {
				if (!client?.active) {
					console.log("WS: Already active or connecting");
					return;
				}
				client?.publish({
					destination: `${WS_DELETE_MESSAGE_PATH}/${myAction.payload.messageId}`,
				});

				break;
			}

			case "call/sendInvite": {
				if (!client?.active) {
					console.log("WS: Already active or connecting");
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
					console.log("WS: Already active or connecting");
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

			case "friend/sendFriendRequest": {
				if (!client?.active) {
					console.log("WS: Already active or connecting");
					return;
				}
				client?.publish({
					destination: `${WS_SEND_FRIEND_REQUEST_PATH}/${myAction.payload.username}`,
				})
				break;
			}

			case "friend/acceptFriendRequest": {
				if (!client?.active) {
					console.log("WS: Already active or connecting");
					return;
				}
				client?.publish({
					destination: `${WS_ACCEPT_FRIEND_REQUEST_PATH}/${myAction.payload.requestId}`
				})
				break;
			}

			case "friend/rejectFriendRequest": {
				if (!client?.active) {
					console.log("WS: Already active or connecting");
					return;
				}

				client?.publish({
					destination: `${WS_REJECT_FRIEND_REQUEST_PATH}/${myAction.payload.requestId}`
				})

				break;
			}
			case "friend/cancelFriendRequest": {
				if (!client?.active) {
					console.log("WS: Already active or connecting");
					return;
				}

				console.log("я cancelFriendRequest");

				client?.publish({
					destination: `${WS_CANCEL_FRIEND_REQUEST_PATH}/${myAction.payload.requestId}`
				})

				break;
			}
			case "friend/removeFriend": {
				if (!client?.active) {
					console.log("WS: Already active or connecting");
					return;
				}


				client?.publish({
					destination: `${WS_REMOVE_FRIEND_REQUEST_PATH}/${myAction.payload.friendUsername}`
				})

				break;
			}
		}
		return next(action);
	}

}

