export type RoomEventsType =
	"ROOM_CREATED" |
	"ROOM_UPDATE" |
	"ROOM_DELETED";


export interface RoomEvents {
	type: RoomEventsType;	
}
