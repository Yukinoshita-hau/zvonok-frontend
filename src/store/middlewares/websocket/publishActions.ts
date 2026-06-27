import type { Actions } from "../../interfaces/actions.interface";
import {
	WS_ACCEPT_FRIEND_REQUEST_PATH,
	WS_CANCEL_FRIEND_REQUEST_PATH,
	WS_DELETE_MESSAGE_PATH,
	WS_EDIT_MESSAGE_PATH,
	WS_REJECT_FRIEND_REQUEST_PATH,
	WS_REMOVE_FRIEND_REQUEST_PATH,
	WS_SEND_ACCEPT_PATH,
	WS_SEND_CHANNEL_MESSAGE_PATH,
	WS_SEND_DECLINE_PATH,
	WS_SEND_END_PATH,
	WS_SEND_FRIEND_REQUEST_PATH,
	WS_SEND_INVITE_PATH,
	WS_SEND_JOIN_PATH,
	WS_SEND_LEAVE_PATH,
	WS_SEND_MESSAGE_PATH,
	WS_SEND_PRIVATE_MESSAGE_PATH,
	WS_UPDATE_READ_MESSAGE_PATH,
	getCodeSessionContentSyncPublishPath,
	getCodeSessionCursorSyncPublishPath,
	getCodeSessionEventsPath,
	getCodeSessionLanguageChangePublishPath,
	getCodeSessionLifecyclePath,
	getCodeSessionStdinSyncPublishPath,
	getCanvasBoardDrawPath,
	getCanvasBoardDrawPublishPath,
	getCanvasBoardLifecyclePath
} from "../../interfaces/wsPathes";
import { channelMessageActions } from "../../slices/channelMessage.slice";
import { canvasActions } from "../../slices/canvas.slice";
import type {
	CanvasBoardEventDto,
	CanvasBoardObjectEventDto,
	CanvasDrawEventDto,
} from "../../../api/interfaces/CanvasDtos";
import { codeSessionActions } from "../../slices/codeSession.slice";
import type { CodeSessionEventDto } from "../../../api/interfaces/codeSessionTypes";
import type { PublishActionResult, WebSocketPublishContext } from "./types";

export function handleWebSocketPublishAction(
	context: WebSocketPublishContext,
	action: Actions
): PublishActionResult {
	switch (action.type) {
		case "message/sendMessage": {
			if (!context.client?.connected) return blockPublish();

			context.client.publish({
				destination: `${WS_SEND_MESSAGE_PATH}/${action.payload.roomId}`,
				body: JSON.stringify(action.payload.content),
			});

			return "handled";
		}
		case "message/sendPrivateMessage": {
			if (!context.client?.connected) return blockPublish();

			context.client.publish({
				destination: `${WS_SEND_PRIVATE_MESSAGE_PATH}/${action.payload.receiver}`,
				body: action.payload.content,
			});

			return "handled";
		}
		case "channelMessage/sendChannelMessage": {
			Object.keys(context.subscriptions).forEach(key => {
				if (key.startsWith("/topic/channel.")) {
					context.subscriptions[key].unsubscribe();
					delete context.subscriptions[key];
				}
			});

			if (!context.client?.connected) return blockPublish();

			const path = `/topic/channel.${action.payload.channelId}`;
			const sub = context.client.subscribe(path, (message) => {
				const data = JSON.parse(message.body);
				context.storeApi.dispatch(channelMessageActions.execEventChannelMessage(data));
			});

			context.subscriptions[path] = sub;

			context.client.publish({
				destination: `${WS_SEND_CHANNEL_MESSAGE_PATH}/${action.payload.channelId}`,
				body: action.payload.content,
			});

			return "handled";
		}
		case "message/editMessage": {
			if (!context.client?.connected) return blockPublish();

			context.client.publish({
				destination: `${WS_EDIT_MESSAGE_PATH}/${action.payload.messageId}`,
				body: action.payload.newContent,
			});

			return "handled";
		}
		case "message/deleteMessage": {
			if (!context.client?.connected) return blockPublish();

			context.client.publish({
				destination: `${WS_DELETE_MESSAGE_PATH}/${action.payload.messageId}`,
			});

			return "handled";
		}
		case "message/markMessageRead": {
			if (!context.client?.connected) return blockPublish();

			context.client.publish({
				destination: `${WS_UPDATE_READ_MESSAGE_PATH}/${action.payload.messageId}`
			});

			return "handled";
		}
		case "call/sendInvite": {
			if (!context.client?.connected) return blockPublish();

			context.client.publish({
				destination: WS_SEND_INVITE_PATH,
				body: JSON.stringify({
					chatRoomId: action.payload.chatRoomId,
					callType: action.payload.callType
				})
			});

			return "handled";
		}
		case "call/sendAccept": {
			if (!context.client?.connected) return blockPublish();

			context.client.publish({
				destination: WS_SEND_ACCEPT_PATH,
				body: JSON.stringify({
					callId: action.payload.callId,
					chatRoomId: action.payload.chatRoomId,
				})
			});

			return "handled";
		}
		case "call/sendJoin": {
			if (!context.client?.connected) return blockPublish();

			context.client.publish({
				destination: WS_SEND_JOIN_PATH,
				body: JSON.stringify({
					callId: action.payload.callId,
					chatRoomId: action.payload.chatRoomId,
				})
			});

			return "handled";
		}
		case "call/sendDecline": {
			if (!context.client?.connected) return blockPublish();

			context.client.publish({
				destination: WS_SEND_DECLINE_PATH,
				body: JSON.stringify({
					callId: action.payload.callId,
					chatRoomId: action.payload.chatRoomId,
				})
			});

			return "handled";
		}
		case "call/sendLeave": {
			console.debug("[call] publish requested: call/sendLeave", action.payload);
			if (!context.client?.connected) {
				console.warn("WS not connected: call/sendLeave skipped");
				return "blocked";
			}

			context.client.publish({
				destination: WS_SEND_LEAVE_PATH,
				body: JSON.stringify({
					callId: action.payload.callId,
					chatRoomId: action.payload.chatRoomId,
				})
			});

			return "handled";
		}
		case "call/sendEnd": {
			console.debug("[call] publish requested: call/sendEnd", action.payload);
			if (!context.client?.connected) return blockPublish();

			context.client.publish({
				destination: WS_SEND_END_PATH,
				body: JSON.stringify({
					callId: action.payload.callId,
					chatRoomId: action.payload.chatRoomId,
				})
			});

			return "handled";
		}
		case "friend/sendFriendRequest": {
			if (!context.client?.active) return blockPublish();

			context.client.publish({
				destination: `${WS_SEND_FRIEND_REQUEST_PATH}/${action.payload.username}`,
			});

			return "handled";
		}
		case "friend/acceptFriendRequest": {
			if (!context.client?.active) return blockPublish();

			context.client.publish({
				destination: `${WS_ACCEPT_FRIEND_REQUEST_PATH}/${action.payload.requestId}`
			});

			return "handled";
		}
		case "friend/rejectFriendRequest": {
			if (!context.client?.active) return blockPublish();

			context.client.publish({
				destination: `${WS_REJECT_FRIEND_REQUEST_PATH}/${action.payload.requestId}`
			});

			return "handled";
		}
		case "friend/cancelFriendRequest": {
			if (!context.client?.active) return blockPublish();

			console.log("я cancelFriendRequest");

			context.client.publish({
				destination: `${WS_CANCEL_FRIEND_REQUEST_PATH}/${action.payload.requestId}`
			});

			return "handled";
		}
		case "friend/removeFriend": {
			if (!context.client?.active) return blockPublish();

			context.client.publish({
				destination: `${WS_REMOVE_FRIEND_REQUEST_PATH}/${action.payload.friendUsername}`
			});

			return "handled";
		}
		case "canvas/subscribeCanvasBoardLifecycle": {
			if (!context.client?.connected) return blockPublish();

			const path = getCanvasBoardLifecyclePath(action.payload);
			if (context.subscriptions[path]) return "handled";

			const sub = context.client.subscribe(path, (message) => {
				const data = JSON.parse(message.body) as CanvasBoardEventDto;
				context.storeApi.dispatch(canvasActions.applyCanvasBoardEvent(data));
			});
			context.subscriptions[path] = sub;

			return "handled";
		}
		case "canvas/unsubscribeCanvasBoardLifecycle": {
			const path = getCanvasBoardLifecyclePath(action.payload);
			context.subscriptions[path]?.unsubscribe();
			delete context.subscriptions[path];

			return "handled";
		}
		case "canvas/subscribeCanvasDrawEvents": {
			if (!context.client?.connected) return blockPublish();

			const path = getCanvasBoardDrawPath(action.payload.callId, action.payload.boardId);
			if (context.subscriptions[path]) return "handled";

			const sub = context.client.subscribe(path, (message) => {
				const data = JSON.parse(message.body) as CanvasDrawEventDto | CanvasBoardObjectEventDto;
				if (isCanvasObjectEvent(data)) {
					context.storeApi.dispatch(canvasActions.applyCanvasObjectEvent(data));
					return;
				}

				const currentUsername = context.storeApi.getState().user.myUser?.username;
				if (currentUsername && data.userId === currentUsername && isOptimisticCanvasStrokeEvent(data)) {
					return;
				}

				context.storeApi.dispatch(canvasActions.applyCanvasDrawEvent(data));
			});
			context.subscriptions[path] = sub;

			return "handled";
		}
		case "canvas/unsubscribeCanvasDrawEvents": {
			const path = getCanvasBoardDrawPath(action.payload.callId, action.payload.boardId);
			context.subscriptions[path]?.unsubscribe();
			delete context.subscriptions[path];

			return "handled";
		}
		case "canvas/sendCanvasDrawEvent": {
			if (!context.client?.connected) return blockPublish();
			if (isEndedCanvasStrokePoint(context, action.payload.boardId, action.payload.event)) {
				return "handled";
			}

			context.client.publish({
				destination: getCanvasBoardDrawPublishPath(action.payload.callId, action.payload.boardId),
				body: JSON.stringify(action.payload.event),
			});

			return "handled";
		}
		case "codeSession/subscribeCodeSession": {
			if (!context.client?.connected) return blockPublish();

			const lifecyclePath = getCodeSessionLifecyclePath(action.payload.callSessionId);
			subscribeCodeSessionPath(context, lifecyclePath, {
				callSessionId: action.payload.callSessionId,
			});

			if (action.payload.sessionId) {
				subscribeCodeSessionPath(context, getCodeSessionEventsPath(action.payload.sessionId), {
					callSessionId: action.payload.callSessionId,
					sessionId: action.payload.sessionId,
				});
			}

			return "handled";
		}
		case "codeSession/unsubscribeCodeSession": {
			const lifecyclePath = getCodeSessionLifecyclePath(action.payload.callSessionId);
			context.subscriptions[lifecyclePath]?.unsubscribe();
			delete context.subscriptions[lifecyclePath];

			if (action.payload.sessionId) {
				const eventPath = getCodeSessionEventsPath(action.payload.sessionId);
				context.subscriptions[eventPath]?.unsubscribe();
				delete context.subscriptions[eventPath];
			}

			return "handled";
		}
		case "codeSession/sendCodeContentSync": {
			if (!context.client?.connected) return blockPublish();
			context.client.publish({
				destination: getCodeSessionContentSyncPublishPath(action.payload.sessionId),
				body: JSON.stringify(action.payload.payload),
			});
			return "handled";
		}
		case "codeSession/sendCodeStdinSync": {
			if (!context.client?.connected) return blockPublish();
			context.client.publish({
				destination: getCodeSessionStdinSyncPublishPath(action.payload.sessionId),
				body: JSON.stringify(action.payload.payload),
			});
			return "handled";
		}
		case "codeSession/sendCodeLanguageChange": {
			if (!context.client?.connected) return blockPublish();
			context.client.publish({
				destination: getCodeSessionLanguageChangePublishPath(action.payload.sessionId),
				body: JSON.stringify(action.payload.payload),
			});
			return "handled";
		}
		case "codeSession/sendCodeCursorSync": {
			if (!context.client?.connected) return blockPublish();
			context.client.publish({
				destination: getCodeSessionCursorSyncPublishPath(action.payload.sessionId),
				body: JSON.stringify(action.payload.payload),
			});
			return "handled";
		}
		default:
			return "not-handled";
	}
}

function subscribeCodeSessionPath(
	context: WebSocketPublishContext,
	path: string,
	fallback?: { callSessionId?: number | null; sessionId?: number | null }
) {
	if (context.subscriptions[path]) return;

	const sub = context.client.subscribe(path, (message) => {
		const parsed = JSON.parse(message.body) as CodeSessionEventDto;
		const data: CodeSessionEventDto = {
			...parsed,
			sessionId: parsed.sessionId ??
				parsed.codeSessionId ??
				parsed.payload?.sessionId ??
				parsed.payload?.codeSessionId ??
				fallback?.sessionId,
			callSessionId: parsed.callSessionId ??
				parsed.payload?.callSessionId ??
				fallback?.callSessionId,
		};
		const currentUser = context.storeApi.getState().user.myUser;
		const senderId = data.senderId ?? data.payload?.senderId ?? data.userId ?? data.payload?.userId;
		const normalizedSenderId = senderId ? String(senderId) : null;
		const currentUserId = currentUser?.id ? String(currentUser.id) : null;
		const senderUsername = data.senderUsername ??
			data.payload?.senderUsername ??
			data.username ??
			data.payload?.username;
		const isSameUsername = Boolean(currentUser?.username && senderUsername === currentUser.username);

		if (((currentUserId && normalizedSenderId === currentUserId) || isSameUsername) && isLocalEchoCodeSessionEvent(data)) {
			return;
		}

		context.storeApi.dispatch(codeSessionActions.applySessionEvent(data));
	});

	context.subscriptions[path] = sub;
}

function isEndedCanvasStrokePoint(
	context: WebSocketPublishContext,
	boardId: number,
	event: CanvasDrawEventDto
): boolean {
	if (event.type !== "STROKE_POINT" || !event.strokeId) return false;

	const stroke = context.storeApi.getState().canvas.strokesByBoardId[boardId]
		?.find((item) => item.id === event.strokeId);

	return Boolean(stroke?.ended);
}

function isCanvasObjectEvent(event: CanvasDrawEventDto | CanvasBoardObjectEventDto): event is CanvasBoardObjectEventDto {
	return event.type === "NOTE_CREATED" ||
		event.type === "NOTE_UPDATED" ||
		event.type === "NOTE_DELETED" ||
		event.type === "NOTE_VOTED" ||
		event.type === "NOTE_UNVOTED";
}

function isOptimisticCanvasStrokeEvent(event: CanvasDrawEventDto): boolean {
	return event.type === "STROKE_START" ||
		event.type === "STROKE_POINT" ||
		event.type === "STROKE_END";
}

function isLocalEchoCodeSessionEvent(event: CodeSessionEventDto): boolean {
	const type = event.eventType ?? event.type;
	return type === "CODE_CONTENT_SYNC" ||
		type === "CODE_STDIN_SYNC" ||
		type === "CODE_LANGUAGE_CHANGED" ||
		type === "CODE_CURSOR_SYNC";
}

function blockPublish(): PublishActionResult {
	console.log("WS: Already active or connecting");
	return "blocked";
}
