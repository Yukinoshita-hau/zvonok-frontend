import { DisconnectReason, RoomEvent, type Room } from "livekit-client";

export function bindCallRoomLifecycle(room: Room, changed: (state: "connected" | "reconnecting" | "disconnected") => void, ended: () => void) {
	const connected = () => changed("connected");
	const reconnecting = () => changed("reconnecting");
	const disconnected = (reason?: DisconnectReason) => {
		if (reason === DisconnectReason.CLIENT_INITIATED) return;
		if (reason === DisconnectReason.ROOM_DELETED || reason === DisconnectReason.PARTICIPANT_REMOVED || reason === DisconnectReason.DUPLICATE_IDENTITY) ended();
		else changed("disconnected");
	};
	room.on(RoomEvent.Connected, connected).on(RoomEvent.Reconnected, connected)
		.on(RoomEvent.Reconnecting, reconnecting).on(RoomEvent.Disconnected, disconnected);
	return () => {
		room.off(RoomEvent.Connected, connected).off(RoomEvent.Reconnected, connected)
			.off(RoomEvent.Reconnecting, reconnecting).off(RoomEvent.Disconnected, disconnected);
	};
}
