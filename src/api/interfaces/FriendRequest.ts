export type FriendRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED"

export interface FriendRequest {
	requestId: number,
	senderId: number,
	senderUsername: string,
	receiverId: number,
	receiverUsername: string,
	status: FriendRequestStatus,
	createdAt: string,
	updatedAt: string
}
