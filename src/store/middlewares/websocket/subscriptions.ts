import type { Client } from "@stomp/stompjs";
import type { FriendEventMessage } from "../../../api/interfaces/FriendEventMessage";
import type { CallRecordingAction } from "../../../api/interfaces/CallRecordingPayload";
import type { MessageReadStatusContent } from "../../../api/interfaces/MessageReadStatusContent";
import type { RoomEvents } from "../../../api/interfaces/RoomEvents";
import type { UserProfileUpdatedEvent } from "../../../api/interfaces/UserProfileUpdatedEvent";
import type { BaseCallEvent } from "../../interfaces/callEvents.interface";
import {
	WS_CALL_PATH,
	WS_CALL_RECORDING_PATH,
	WS_ERROR_PATH,
	WS_FRIEND_REQUESTS_PATH,
	WS_MESSAGE_READ_PATH,
	WS_MESSAGES_PATH,
	WS_ROOM_EVENTS_PATH,
	WS_USER_EVENTS_PATH
} from "../../interfaces/wsPathes";
import { activeCallActions } from "../../slices/activeCall.slice";
import { callActions, getCallToken } from "../../slices/call.slice";
import { fetchIncomingRequests, fetchMyFriends, fetchOutgoingRequests } from "../../slices/friend.slice";
import { fetchRoomMessages, messageActions } from "../../slices/message.slice";
import { notificationAction } from "../../slices/notification.slice";
import { fetchMyRooms } from "../../slices/room.slice";
import { toastActions } from "../../slices/toast.slice";
import { userActions } from "../../slices/user.slice";
import { usersActions } from "../../slices/users.slice";
import { normalizeMessage } from "../../../utils/normalizeMessage";
import { soundPlayer } from "../../../utils/soundPlayer";
import type { SubscriptionRegistry, WebSocketStoreApi } from "./types";

export function registerWebSocketSubscriptions(
	client: Client,
	storeApi: WebSocketStoreApi,
	subscriptions: SubscriptionRegistry
) {
	const personalMessageSub = client.subscribe(WS_MESSAGES_PATH, async (message) => {
		const data = JSON.parse(message.body);
		const normalized = normalizeMessage(data);
		const state = storeApi.getState();
		const myUsername = state.user.myUser?.username;
		const activeRoomId = state.message.activeRoomId;

		if (data.sender) {
			storeApi.dispatch(usersActions.upsertUser(data.sender));
		}

		if (data.room?.members) {
			storeApi.dispatch(usersActions.upsertUsers(data.room.members));
		}

		const isFromMe = data.sender?.username === myUsername;
		const isActiveRoom = data.room?.id === activeRoomId;

		if (!isFromMe && !isActiveRoom && data.room?.id) {
			soundPlayer.playMessage();
		}

		storeApi.dispatch(usersActions.upsertUser(normalized.user));
		storeApi.dispatch(messageActions.execEventMessage(normalized.message));

		await storeApi.dispatch(fetchMyRooms());

		if (!activeRoomId && data.room?.id && data.sender?.username === state.user.myUser?.username) {
			storeApi.dispatch(messageActions.setActiveRoom(data.room.id));
			storeApi.dispatch(fetchRoomMessages({ roomId: data.room.id }));
		}
	});
	subscriptions[WS_MESSAGES_PATH] = personalMessageSub;

	const personalCallSub = client.subscribe(WS_CALL_PATH, (message) => {
		const data = JSON.parse(message.body) as BaseCallEvent;
		console.log(data);

		storeApi.dispatch(callActions.applyCallEvent(data));
		storeApi.dispatch(activeCallActions.handleCallEvent(data));

		const callId = data.callId;
		if (!callId) return;

		if (data.type === "CALL_STARTED") {
			const state = storeApi.getState().call;

			if (!state.participantToken || state.callId !== callId) {
				storeApi.dispatch(getCallToken(callId));
			}
			return;
		}

		if (data.type === "CALL_ACCEPT" || data.type === "CALL_ACCEPTED") {
			console.log("it is accepted");
			console.log(data);
			const state = storeApi.getState().call;

			if (state.lastAcceptedCallId === callId) return;
			if (state.callId && state.callId !== callId) return;
			if (state.participantToken && state.callId === callId) return;

			storeApi.dispatch(callActions.markAcceptedHandled(callId));
			storeApi.dispatch(getCallToken(callId));
		}

		if (data.type === "CALL_PARTICIPANT_JOINED") {
			const state = storeApi.getState();
			const myUsername = state.user.myUser?.username;
			const isMe = data.participantUsername === myUsername;

			if (!isMe) return;

			const callState = state.call;

			if (callState.lastAcceptedCallId === callId) return;
			if (callState.callId && callState.callId !== callId) return;
			if (callState.participantToken && callState.callId === callId) return;

			storeApi.dispatch(callActions.markAcceptedHandled(callId));
			storeApi.dispatch(getCallToken(callId));
		}
	});
	subscriptions[WS_CALL_PATH] = personalCallSub;

	const personalCallRecordingSub = client.subscribe(WS_CALL_RECORDING_PATH, (message) => {
		const data = JSON.parse(message.body) as CallRecordingAction;
		console.log(data);
	});
	subscriptions[WS_CALL_RECORDING_PATH] = personalCallRecordingSub;

	const personalFriendRequestSub = client.subscribe(WS_FRIEND_REQUESTS_PATH, (message) => {
		const data = JSON.parse(message.body) as FriendEventMessage;
		console.log(data);

		const myUsername = storeApi.getState().user.myUser?.username;

		switch (data.type) {
			case "FRIEND_REQUEST_ACCEPTED": {
				if (data.payload?.senderUsername === myUsername) {
					storeApi.dispatch(fetchOutgoingRequests());

					storeApi.dispatch(notificationAction.pushNotification({
						notification: {
							type: "success",
							title: "Запрос в друзья принят",
							message: `${data.payload?.receiverUsername} теперь ваш друг`,
							createdAt: new Date().toISOString(),
							read: false,
							target: { type: "FRIEND_PROFILE", username: data.payload?.receiverUsername }
						}
					}));

					storeApi.dispatch(toastActions.showToast({
						id: crypto.randomUUID(),
						type: "success",
						title: "Запрос в друзья принят",
						message: `${data.payload?.receiverUsername} теперь ваш друг`
					}));
				} else if (data.payload?.receiverUsername === myUsername) {
					storeApi.dispatch(fetchIncomingRequests());
				}

				storeApi.dispatch(fetchMyFriends());
				storeApi.dispatch(fetchMyRooms());
				break;
			}
			case "FRIEND_REQUEST_CREATED": {
				if (data.payload?.senderUsername === myUsername) {
					storeApi.dispatch(fetchOutgoingRequests());
				} else if (data.payload?.receiverUsername === myUsername) {
					storeApi.dispatch(notificationAction.pushNotification({
						notification: {
							type: "info",
							title: "Новый запрос в друзья",
							message: `${data.payload?.senderUsername} хочет добавить вас в друзья`,
							createdAt: new Date().toISOString(),
							read: false,
							target: { type: "FRIEND_PROFILE", username: data.payload?.receiverUsername }
						}
					}));

					storeApi.dispatch(toastActions.showToast({
						id: crypto.randomUUID(),
						type: "info",
						title: "Новый запрос в друзья",
						message: `${data.payload?.senderUsername} хочет добавить вас в друзья`
					}));
					storeApi.dispatch(fetchIncomingRequests());
				}

				break;
			}
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
	});
	subscriptions[WS_FRIEND_REQUESTS_PATH] = personalFriendRequestSub;

	const errorSub = client.subscribe(WS_ERROR_PATH, (message) => {
		const data = JSON.parse(message.body) as { message: string; status: number };
		if (data.message !== "Message was not found") {
			storeApi.dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "error",
				title: "Error",
				message: data.message
			}));
		}
	});
	subscriptions[WS_ERROR_PATH] = errorSub;

	const messageReadSub = client.subscribe(WS_MESSAGE_READ_PATH, (message) => {
		const data = JSON.parse(message.body) as MessageReadStatusContent;
		storeApi.dispatch(messageActions.messageReadUpdate({
			messageId: data.messageId,
			readBy: data.readBy
		}));
		console.log(data);
	});
	subscriptions[WS_MESSAGE_READ_PATH] = messageReadSub;

	const messageRoomEventsSub = client.subscribe(WS_ROOM_EVENTS_PATH, (message) => {
		const data = JSON.parse(message.body) as RoomEvents;

		switch (data.type) {
			case "ROOM_CREATED": {
				storeApi.dispatch(fetchMyRooms());
				break;
			}
		}
	});
	subscriptions[WS_ROOM_EVENTS_PATH] = messageRoomEventsSub;

	const userEventsSub = client.subscribe(WS_USER_EVENTS_PATH, (message) => {
		const data = JSON.parse(message.body) as UserProfileUpdatedEvent;
		const eventType = data.type ?? data.eventType;

		switch (eventType) {
			case "USER_PROFILE_UPDATED": {
				const updatedUser = data.user;

				if (!updatedUser?.id) return;

				storeApi.dispatch(usersActions.upsertUser(updatedUser));

				const myUserId = storeApi.getState().user.myUser?.id;

				if (myUserId === updatedUser.id) {
					storeApi.dispatch(userActions.patchMyUser(updatedUser));
				}

				break;
			}
		}

		storeApi.dispatch(fetchMyRooms());
	});
	subscriptions[WS_USER_EVENTS_PATH] = userEventsSub;
}
