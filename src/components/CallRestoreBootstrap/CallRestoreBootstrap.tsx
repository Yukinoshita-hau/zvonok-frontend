import { useDispatch, useSelector, useStore } from "react-redux"
import type { AppDispatch, RootState } from "../../store/store"
import { useEffect, useRef } from "react";
import { restoreCallSession } from "../../store/slices/call.slice";
import { useLocation } from "react-router-dom";


export function CallRestoreBootstrap() {
	const dispatch = useDispatch<AppDispatch>();
	const isAuthenticated = useSelector((s: RootState) => s.user.isAuthChecked);
	const store = useStore<RootState>();
	const location = useLocation();
	const restoreStartedRef = useRef(false);

	useEffect(() => {
		if (!isAuthenticated) return;
		if (restoreStartedRef.current) return;
		if (location.pathname.startsWith("/conference/")) return;
		if (!["idle", "ended"].includes(store.getState().call.status)) return;

		restoreStartedRef.current = true;
		// A reload can race the previous document's pagehide disconnect/release.
		let stopped = false;
		void (async () => {
			for (let attempt = 0; attempt < 8 && !stopped; attempt++) {
				const result = await dispatch(restoreCallSession()).unwrap().catch(() => null);
				if (result?.mediaOwnership !== "PASSIVE") return;
				await new Promise(resolve => setTimeout(resolve, 2000));
			}
		})();
		return () => { stopped = true; };
	}, [dispatch, isAuthenticated, location.pathname, store])

	return null;
}
