import { useEffect, useRef } from "react";
import { NavigateBar } from "../../components/NavigateBar/NavigateBar";
import styles from "./AppLayout.module.css";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { callActions } from "../../store/slices/call.slice";
import { Outlet, useLocation } from "react-router-dom";
import { CallOverlay } from "../../components/CallOverlay/CallOverlay";
import { ActiveCallOverlay } from "../../components/ActiveCallOverlay/ActiveCallOverlay";
import { websocketActions } from "../../store/slices/websocket.slice";
import { ToastContainer } from "../../components/ToastContainer/ToastContainer";
import { CallRestoreBootstrap } from "../../components/CallRestoreBootstrap/CallRestoreBootstrap";
import { DesktopNotificationBridge } from "../../components/DesktopNotificationBridge/DesktopNotificationBridge";
import { ShellUserPanel } from "../../components/ShellUserPanel/ShellUserPanel";
import "../../styles/shell.css";
import { SettingsContentSlot } from "../../features/settingsV2/SettingsContentSlot";

export function AppLayout() {
	const dispatch = useDispatch<AppDispatch>();
	const location = useLocation();
	const callConnected = useSelector((state: RootState) => state.call.status === "in_call" && state.call.mediaState === "connected");
	const previousRoute = useRef(location.pathname + location.search);
	useEffect(() => {
		const route = location.pathname + location.search;
		if (previousRoute.current !== route && callConnected)
			dispatch(callActions.setPresentationMode("minimized"));
		previousRoute.current = route;
	}, [location.pathname, location.search, dispatch, previousRoute, callConnected]);
	const wsStatus = useSelector((s: RootState) => s.websocket.status);

	useEffect(() => {
		if (wsStatus === "idle") {
			dispatch(websocketActions.connectStart());
		}
	}, [dispatch, wsStatus]);

	return (
		<div className={styles["layout"]}>
			<NavigateBar />
			<div className={styles["content"]}>
				{location.pathname.startsWith('/conference/') || location.pathname.startsWith('/invite/')
					? <SettingsContentSlot overlay><Outlet /></SettingsContentSlot>
					: <Outlet />}
				<CallRestoreBootstrap />
				<CallOverlay />
				<ActiveCallOverlay />
				<ToastContainer />
				<DesktopNotificationBridge />
			</div>
			<ShellUserPanel />
		</div>
	);
}
