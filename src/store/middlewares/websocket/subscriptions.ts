import { isCallEvent, isFriendNotificationPayload, isMessage, isRecord, isRoomResponse, isUserMini, isUserProfileUpdate, parseObject } from "./payloadValidation";
import type { Client } from "@stomp/stompjs";
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
import { fetchMyRooms, roomActions } from "../../slices/room.slice";
import { toastActions } from "../../slices/toast.slice";
import { userActions } from "../../slices/user.slice";
import { usersActions } from "../../slices/users.slice";
import { normalizeMessage } from "../../../utils/normalizeMessage";
import { normalizeRoom } from "../../../utils/normalizeRoom";
import { soundPlayer } from "../../../utils/soundPlayer";
import { isAppFocused, showDesktopNotification, type DesktopNotificationPayload } from "../../../services/desktop.service";
import type { SubscriptionRegistry, WebSocketStoreApi } from "./types";
import { createRefreshQueue } from "./refreshQueue";

export function registerWebSocketSubscriptions(
	client: Client,
	storeApi: WebSocketStoreApi,
	subscriptions: SubscriptionRegistry
) {
	const refreshRooms = createRefreshQueue(() => Promise.resolve(storeApi.dispatch(fetchMyRooms())));
	const personalMessageSub = client.subscribe(WS_MESSAGES_PATH, async (message) => {
		const data = parseObject(message.body);
		if (!isMessage(data)) return;
		const normalized = normalizeMessage(data);
		const state = storeApi.getState();
		const myUsername = state.user.myUser?.username;
		const activeRoomId = state.message.activeRoomId;




		const isFromMe = data.sender?.username === myUsername;
		const isActiveRoom = data.room?.id === activeRoomId;

		if (!isFromMe && !isActiveRoom && data.room?.id) {
			soundPlayer.playMessage();
		}

		if (!isFromMe && data.eventType === "MESSAGE" && data.room?.id && !(isActiveRoom && isAppFocused())) {
			pushDesktopNotification({
				type: "message",
				title: data.sender?.displayName ?? data.sender?.username ?? "Новое сообщение",
				body: getMessageNotificationBody(normalized.message.content, normalized.message.attachments.length),
				roomId: data.room.id,
				userId: data.sender?.id,
			});
		}

		storeApi.dispatch(usersActions.upsertUser(normalized.user));
		storeApi.dispatch(messageActions.execEventMessage(normalized.message));

		await refreshRooms();

		if (!storeApi.getState().message.activeRoomId && data.room?.id && data.sender?.username === state.user.myUser?.username) {
			storeApi.dispatch(messageActions.setActiveRoom(data.room.id));
			storeApi.dispatch(fetchRoomMessages({ roomId: data.room.id }));
		}
	});
	subscriptions[WS_MESSAGES_PATH] = personalMessageSub;

	const personalCallSub = client.subscribe(WS_CALL_PATH, (message) => {
		const raw = parseObject(message.body);
		const data = raw && Object.fromEntries(Object.entries(raw).filter(([key, value]) => key === "endReason" || value !== null));
		if (!isCallEvent(data)) return;
		const current = storeApi.getState().call;
		if (data.callId && current.closedCallIds.includes(data.callId)) {
			storeApi.dispatch(activeCallActions.handleCallEvent(data));
			return;
		}
		if (current.status === "outgoing_ringing" && data.type === "CALL_INVITE") {
			storeApi.dispatch(activeCallActions.handleCallEvent(data));
			return;
		}
		if (current.conferenceCode || (current.callId && data.callId && current.callId !== data.callId)) {
			storeApi.dispatch(activeCallActions.handleCallEvent(data));
			return;
		}
		if (data.eventId && current.processedEventIds.includes(data.eventId)) return;
		// Group acceptance is broadcast to every invitee. It does not accept my invitation.
		if (current.status === "incoming_ringing" && current.roomType === "GROUP"
			&& ["CALL_ACCEPT", "CALL_ACCEPTED", "CALL_PARTICIPANT_JOINED"].includes(data.type)
			&& data.participantUsername !== storeApi.getState().user.myUser?.username) {
			storeApi.dispatch(activeCallActions.handleCallEvent(data));
			return;
		}

		storeApi.dispatch(callActions.applyCallEvent(data));
		storeApi.dispatch(activeCallActions.handleCallEvent(data));
		if (data.type === "CALL_PARTICIPANT_DECLINED" && data.participantUsername === storeApi.getState().user.myUser?.username && data.callId) {
			storeApi.dispatch(callActions.incomingInvitationExpired(data.callId));
			if (storeApi.getState().activeCall.incomingCall?.callId === data.callId) storeApi.dispatch(activeCallActions.clearIncomingCall());
		}

		if (data.type === "CALL_INVITE") {
			const state = storeApi.getState();
			const callerUsername = data.callerUsername ?? data.fromUser;

			if (callerUsername !== state.user.myUser?.username && !isAppFocused()) {
				pushDesktopNotification({
					type: "call",
					title: "Входящий звонок",
					body: callerUsername ? `${callerUsername} звонит вам` : "У вас входящий звонок",
					roomId: data.chatRoomId ?? data.roomId,
					callId: data.callId,
				});
			}
		}

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
		const data = parseObject(message.body);
		if (!data) return;
		console.log(data);
	});
	subscriptions[WS_CALL_RECORDING_PATH] = personalCallRecordingSub;

	const personalFriendRequestSub = client.subscribe(WS_FRIEND_REQUESTS_PATH, (message) => {
		const raw = parseObject(message.body);
		if (!raw || typeof raw.type !== "string" || (raw.payload !== null && !isRecord(raw.payload))) return;
		if (raw.payload !== null && !isFriendNotificationPayload(raw.payload)) return;
		const data = { type: raw.type, payload: raw.payload };

		const myUsername = storeApi.getState().user.myUser?.username;

		switch (data.type) {
			case "FRIEND_REQUEST_ACCEPTED": {
				if (!data.payload?.receiverUsername || !data.payload.senderUsername) return;
				if (data.payload?.senderUsername === myUsername) {
					storeApi.dispatch(fetchOutgoingRequests());

					storeApi.dispatch(notificationAction.pushNotification({
						notification: {
							id: crypto.randomUUID(),
							type: "success",
							title: "Запрос в друзья принят",
							message: `${data.payload?.receiverUsername} теперь ваш друг`,
							createdAt: new Date().toISOString(),
							read: false,
							target: { type: "FRIEND_PROFILE", username: data.payload.receiverUsername }
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
				void refreshRooms();
				break;
			}
			case "FRIEND_REQUEST_CREATED": {
				if (!data.payload?.receiverUsername || !data.payload.senderUsername) return;
				if (data.payload?.senderUsername === myUsername) {
					storeApi.dispatch(fetchOutgoingRequests());
				} else if (data.payload?.receiverUsername === myUsername) {
					pushDesktopNotification({
						type: "friend_request",
						title: "Новая заявка в друзья",
						body: `${data.payload?.senderDisplayName ?? data.payload?.senderUsername} хочет добавить вас в друзья`,
						userId: data.payload?.senderId,
					});

					storeApi.dispatch(notificationAction.pushNotification({
						notification: {
							id: crypto.randomUUID(),
							type: "info",
							title: "Новый запрос в друзья",
							message: `${data.payload?.senderUsername} хочет добавить вас в друзья`,
							createdAt: new Date().toISOString(),
							read: false,
							target: { type: "FRIEND_PROFILE", username: data.payload.senderUsername }
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
		const data = parseObject(message.body);
		if (!data || typeof data.message !== "string" || typeof data.status !== "number") return;
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
		const data = parseObject(message.body);
		if (!data || typeof data.messageId !== "number" || !Number.isSafeInteger(data.messageId) || data.messageId <= 0 || typeof data.readBy !== "string") return;
		storeApi.dispatch(messageActions.messageReadUpdate({
			messageId: data.messageId,
			readBy: data.readBy
		}));
		console.log(data);
	});
	subscriptions[WS_MESSAGE_READ_PATH] = messageReadSub;

	const messageRoomEventsSub = client.subscribe(WS_ROOM_EVENTS_PATH, (message) => {
		const raw = parseObject(message.body);
		if (!raw || typeof raw.type !== "string") return;
		if (raw.roomId !== undefined && (typeof raw.roomId !== "number" || !Number.isSafeInteger(raw.roomId) || raw.roomId <= 0)) return;
		if (raw.members !== undefined && !Array.isArray(raw.members)) return;
		if (raw.payload != null && (!isRecord(raw.payload) || typeof raw.payload.roomId !== "number" || (raw.payload.userId !== undefined && typeof raw.payload.userId !== "number"))) return;
		const data = { type: raw.type, roomId: typeof raw.roomId === "number" ? raw.roomId : undefined, room: raw.room, members: raw.members, payload: isRecord(raw.payload) && typeof raw.payload.roomId === "number" ? { roomId: raw.payload.roomId, userId: raw.payload.userId } : undefined };

		switch (data.type) {
			case "ROOM_CREATED": {
				void refreshRooms();
				break;
			}

            case "ROOM_MESSAGES_CLEARED": {
                const roomId = data.roomId ?? data.payload?.roomId;
                if (!roomId) return;
                void refreshRooms();
                if (storeApi.getState().message.activeRoomId === roomId) {
                    storeApi.dispatch(fetchRoomMessages({ roomId, resync: true }));
                }
                break;
            }

			case "ROOM_MEMBERS_ADDED": {
				if (isRoomResponse(data.room)) {
					const { room, users } = normalizeRoom(data.room);
					storeApi.dispatch(usersActions.upsertUsers(users));
					storeApi.dispatch(roomActions.upsertRoom(room));
					break;
				}

				if (!data.roomId || !Array.isArray(data.members)) {
					void refreshRooms();
					break;
				}

				const members = data.members.filter(isUserMini);
				storeApi.dispatch(usersActions.upsertUsers(members));
				storeApi.dispatch(roomActions.addMembersToRoomState({
					roomId: data.roomId,
					memberIds: members.map((member) => member.id),
				}));
				break;
			}

			case "ROOM_MEMBER_LEFT": {
				const payload = data.payload;
				if (!payload?.roomId || typeof payload.userId !== "number") {
					void refreshRooms();
					break;
				}

				const state = storeApi.getState();
				const myUserId = state.user.myUser?.id;

				if (payload.userId === myUserId) {
					storeApi.dispatch(roomActions.removeRoomState({ roomId: payload.roomId }));

					if (state.message.activeRoomId === payload.roomId) {
						storeApi.dispatch(messageActions.setActiveRoom(null));
						storeApi.dispatch(messageActions.clearMessages());
					}

					break;
				}

				storeApi.dispatch(roomActions.removeMemberFromRoomState({
					roomId: payload.roomId,
					userId: payload.userId,
				}));
				break;
			}
		}
	});
	subscriptions[WS_ROOM_EVENTS_PATH] = messageRoomEventsSub;

	const userEventsSub = client.subscribe(WS_USER_EVENTS_PATH, (message) => {
		const data = parseObject(message.body);
		if (!data || !isUserProfileUpdate(data.user)) return;
		const eventType = data.type ?? data.eventType;

		switch (eventType) {
			case "USER_PROFILE_UPDATED": {
				const updatedUser = data.user;

				if (!updatedUser?.id) return;

				storeApi.dispatch(usersActions.patchUser(updatedUser));

				const myUserId = storeApi.getState().user.myUser?.id;

				if (myUserId === updatedUser.id) {
					storeApi.dispatch(userActions.patchMyUser(updatedUser));
				}

				break;
			}
		}

	});
	subscriptions[WS_USER_EVENTS_PATH] = userEventsSub;
}

function pushDesktopNotification(payload: DesktopNotificationPayload) {
	void showDesktopNotification(payload).catch((error) => {
		console.warn("Failed to show desktop notification", error);
	});
}

function getMessageNotificationBody(content: string | null, attachmentsCount: number) {
	const trimmed = content?.trim();
	if (trimmed) return trimmed;
	if (attachmentsCount > 0) return attachmentsCount === 1 ? "Вложение" : `Вложения: ${attachmentsCount}`;
	return "Новое сообщение";
}
