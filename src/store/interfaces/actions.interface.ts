
interface WsConnectAction {
	type: "websocket/connectStart";
}

interface SendMessageAction {
	type: "message/sendMessage";
	payload: {
		roomId: string, content: {
			content: string,
			replyToMessageId: number | null
		}
	};
}

interface SendPrivateMessageAction {
	type: "message/sendPrivateMessage";
	payload: { receiver: string, content: string }
}

interface SendChannelMessageAction {
	type: "channelMessage/sendChannelMessage";
	payload: { channelId: string, content: string }
}

interface EditMessageAction {
	type: "message/editMessage";
	payload: { messageId: number, newContent: string };
}

interface DeleteMessageAction {
	type: "message/deleteMessage";
	payload: { messageId: number };
}

interface MarkMessageReadAction {
	type: "message/markMessageRead";
	payload: {
		messageId: number;
	}
}

interface CallInviteAction {
	type: "call/sendInvite";
	payload: { chatRoomId: number; callType: "audio" | "video" }
}

interface CallAcceptAction {
	type: "call/sendAccept";
	payload: { callId: number; chatRoomId?: number }
}

interface CallJoinAction {
	type: "call/sendJoin";
	payload: { callId: number; chatRoomId?: number }
}

interface CallDeclineAction {
	type: "call/sendDecline";
	payload: { callId: number; chatRoomId?: number }
}

interface CallEndAction {
	type: "call/sendEnd";
	payload: { callId: number; chatRoomId?: number }
}

interface CallLeaveAction {
	type: "call/sendLeave";
	payload: { callId?: number; chatRoomId?: number }
}

interface SendFriendRequestAction {
	type: "friend/sendFriendRequest";
	payload: { username: string }
}

interface AcceptFriendRequestAction {
	type: "friend/acceptFriendRequest";
	payload: { requestId: number }
}

interface RejectFriendRequestAction {
	type: "friend/rejectFriendRequest";
	payload: { requestId: number }
}

interface CancelFriendRequestAction {
	type: "friend/cancelFriendRequest";
	payload: { requestId: number }
}

interface RemoveFriendAction {
	type: "friend/removeFriend";
	payload: { friendUsername: number }
}

interface CanvasLifecycleSubscribeAction {
	type: "canvas/subscribeCanvasBoardLifecycle";
	payload: number;
}

interface CanvasLifecycleUnsubscribeAction {
	type: "canvas/unsubscribeCanvasBoardLifecycle";
	payload: number;
}

interface CanvasDrawSubscribeAction {
	type: "canvas/subscribeCanvasDrawEvents";
	payload: { callId: number; boardId: number };
}

interface CanvasDrawUnsubscribeAction {
	type: "canvas/unsubscribeCanvasDrawEvents";
	payload: { callId: number; boardId: number };
}

interface CanvasDrawSendAction {
	type: "canvas/sendCanvasDrawEvent";
	payload: {
		callId: number;
		boardId: number;
		event: {
			type:
				| "STROKE_START"
				| "STROKE_POINT"
				| "STROKE_END"
				| "STROKE_REMOVED"
				| "BOARD_CLEAR"
				| "CURSOR_MOVE"
				| "CURSOR_LEAVE"
				| "LASER_POINT"
				| "LASER_END"
				| "REACTION"
				| "VIEWPORT_CHANGED";
			boardId: number;
			strokeId?: string | null;
			userId?: string | null;
			x?: number | null;
			y?: number | null;
			color?: string | null;
			width?: number | null;
			tool?: "PEN" | "ERASER" | null;
			reaction?: "THUMBS_UP" | "FIRE" | "QUESTION" | "CHECK" | "EYES" | null;
			zoom?: number | null;
			timestamp?: string | null;
		};
	}
}
export type Actions =
	| WsConnectAction
	| SendMessageAction
	| SendPrivateMessageAction
	| SendChannelMessageAction
	| EditMessageAction
	| DeleteMessageAction
	| MarkMessageReadAction
	| CallInviteAction
	| CallAcceptAction
	| CallJoinAction
	| CallDeclineAction
	| CallEndAction
	| CallLeaveAction
	| SendFriendRequestAction
	| AcceptFriendRequestAction
	| RejectFriendRequestAction
	| CancelFriendRequestAction
	| RemoveFriendAction
	| CanvasLifecycleSubscribeAction
	| CanvasLifecycleUnsubscribeAction
	| CanvasDrawSubscribeAction
	| CanvasDrawUnsubscribeAction
	| CanvasDrawSendAction;
