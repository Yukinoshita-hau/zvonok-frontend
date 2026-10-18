import { useEffect } from "react"
import { NavigateBar } from "../../components/NavigateBar/NavigateBar"
import styles from "./AppLayout.module.css"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "../../store/store";
import { Outlet } from "react-router-dom";
import { CallOverlay } from "../../components/CallOverlay/CallOverlay";
import { ActiveCallOverlay } from "../../components/ActiveCallOverlay/ActiveCallOverlay";
import { websocketActions } from "../../store/slices/websocket.slice";
import { ToastContainer } from "../../components/ToastContainer/ToastContainer";
import { CallRestoreBootstrap } from "../../components/CallRestoreBootstrap/CallRestoreBootstrap";
import { DesktopNotificationBridge } from "../../components/DesktopNotificationBridge/DesktopNotificationBridge";

export function AppLayout() {
	const dispatch = useDispatch<AppDispatch>();
	const wsStatus = useSelector((s: RootState) => s.websocket.status);


	useEffect(() => {
		if (wsStatus === "idle") {
			dispatch(websocketActions.connectStart());
		}
	}, [dispatch, wsStatus])

	return <div className={styles["layout"]}>
		<NavigateBar />
		<div className={styles["content"]}>
			<Outlet />
			<CallRestoreBootstrap />
			<CallOverlay />
			<ActiveCallOverlay />
			<ToastContainer />
			<DesktopNotificationBridge />
		</div>
	</div>
}
