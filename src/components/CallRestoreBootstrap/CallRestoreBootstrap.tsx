import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "../../store/store"
import { useEffect } from "react";
import { restoreCallSession } from "../../store/slices/call.slice";


export function CallRestoreBootstrap() {
	const dispatch = useDispatch<AppDispatch>();
	const isAuthenticated = useSelector((s: RootState) => s.user.isAuthChecked);
	const callStatus = useSelector((s: RootState) => s.call.status);

	useEffect(() => {
		if (!isAuthenticated) return;
		if (callStatus !== "idle" && callStatus !== "ended") return;

		dispatch(restoreCallSession());
	}, [dispatch, isAuthenticated])

	return null;
}
