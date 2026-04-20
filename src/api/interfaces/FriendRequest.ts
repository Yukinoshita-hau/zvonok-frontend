export type FriendRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED"

export interface FriendRequest {
	requestId: number,
	senderId: number,
	senderUsername: string,
	senderDisplayName: string;
	senderAvatarUrl: string;
	receiverId: number,
	receiverUsername: string,
	receiverAvatarUrl: string,
	status: FriendRequestStatus,
	createdAt: string,
	updatedAt: string
}
