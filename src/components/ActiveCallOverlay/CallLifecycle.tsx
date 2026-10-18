import { useRoomContext } from "@livekit/components-react";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../store/store";
import { callActions } from "../../store/slices/call.slice";
import { bindCallRoomLifecycle } from "./callRoomLifecycle";

export function CallLifecycle({ roomName, generation }: { roomName: string; generation: number }) {
	const room = useRoomContext();
	const dispatch = useDispatch<AppDispatch>();
	useEffect(() => bindCallRoomLifecycle(room,
		status => dispatch(callActions.mediaConnectionChanged({ roomName, generation, status })),
		() => dispatch(callActions.mediaSessionEnded({ roomName, generation }))), [room, roomName, generation, dispatch]);
	return null;
}
