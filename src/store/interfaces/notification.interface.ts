type NotificationTarget =
	| { type: "CHAT"; roomId: number }
	| { type: "FRIEND_REQUESTS" }
	| { type: "FRIEND_PROFILE"; username: string }
	| { type: "CALL_HISTORY"; roomId?: number }
	| { type: "SYSTEM" };

export interface Notification {
	id: string;
	type: "info" | "success" | "warning" | "error"
	title: string;
	message: string;
	createdAt: string;
	read: boolean;
	target: NotificationTarget;
}
