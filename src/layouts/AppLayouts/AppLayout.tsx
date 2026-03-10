import { useEffect } from "react"
import { NavigateBar } from "../../components/NavigateBar/NavigateBar"
import styles from "./AppLayout.module.css"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "../../store/store";
import { fetchMyServers } from "../../store/slices/server.slice";
import { Outlet } from "react-router-dom";
import { CallOverlay } from "../../components/CallOverlay/CallOverlay";
import { websocketActions } from "../../store/slices/websocket.slice";

export function AppLayout() {
	const dispatch = useDispatch<AppDispatch>();
	const { status, servers } = useSelector((s: RootState) => s.server)
	const wsStatus = useSelector((s: RootState) => s.websocket.status);

	useEffect(() => {
		if (status === "idle") {
			dispatch(fetchMyServers());
		}
	}, [dispatch, status])

	useEffect(() => {
		if (wsStatus === "idle") {
			dispatch(websocketActions.connectStart());
		}
	}, [dispatch, wsStatus])

	return <div className={styles["layout"]}>
		<NavigateBar servers={servers ? servers : []} />
		<div className={styles["content"]}>
			<Outlet />
			<CallOverlay/>
		</div>
	</div>
}
