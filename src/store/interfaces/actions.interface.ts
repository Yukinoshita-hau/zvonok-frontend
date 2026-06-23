
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
	| RemoveFriendAction;
