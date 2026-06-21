import { useEffect } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store/store";
import { getActiveCall } from "../store/slices/activeCall.slice";

export function useActiveRoomCall(roomId: number | null) {
	const dispatch = useDispatch<AppDispatch>();

	useEffect(() => {
		if (!roomId) return;
		dispatch(getActiveCall(roomId));
	}, [dispatch, roomId]);
}
