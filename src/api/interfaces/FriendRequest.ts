export type FriendRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED"

export interface FriendRequest {
	requestId: number,
	senderId: number,
	senderUsername: string,
	senderDisplayName: string;
	senderAvatarUrl: string | null;
	receiverId: number,
	receiverUsername: string,
	receiverDisplayName: string,
	receiverAvatarUrl: string | null,
	status: FriendRequestStatus,
	createdAt: string,
	updatedAt: string
}
