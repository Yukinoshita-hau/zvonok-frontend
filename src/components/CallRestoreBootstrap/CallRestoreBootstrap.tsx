import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "../../store/store"
import { useEffect, useRef } from "react";
import { restoreCallSession } from "../../store/slices/call.slice";
import { useLocation } from "react-router-dom";


export function CallRestoreBootstrap() {
	const dispatch = useDispatch<AppDispatch>();
	const isAuthenticated = useSelector((s: RootState) => s.user.isAuthChecked);
	const callStatus = useSelector((s: RootState) => s.call.status);
	const location = useLocation();
	const restoreStartedRef = useRef(false);

	useEffect(() => {
		if (!isAuthenticated) return;
		if (restoreStartedRef.current) return;
		if (location.pathname.startsWith("/conference/")) return;
		if (callStatus !== "idle" && callStatus !== "ended") return;

		restoreStartedRef.current = true;
		dispatch(restoreCallSession());
	}, [dispatch, isAuthenticated, callStatus, location.pathname])

	return null;
}
