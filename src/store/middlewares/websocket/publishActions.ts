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
	WS_UPDATE_READ_MESSAGE_PATH
} from "../../interfaces/wsPathes";
import { channelMessageActions } from "../../slices/channelMessage.slice";
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
		default:
			return "not-handled";
	}
}

function blockPublish(): PublishActionResult {
	console.log("WS: Already active or connecting");
	return "blocked";
}
