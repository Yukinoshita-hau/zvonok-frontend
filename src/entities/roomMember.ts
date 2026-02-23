export type memberStatus =
	"ONLINE" |
	"OFFLINE" |
	"AWAY" |
	"BUSY" |
	"INVISIBLE"


export interface RoomMembers {
	id: number,
	username: string,
	status: memberStatus,
	lastSeenAt: string,
	avatarUrl: null,
	updatedAt: string,
	createdAt: string
}
