import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Bell, MessageCircle } from "lucide-react";
import type { AppDispatch, RootState } from "../../store/store";
import { callActions } from "../../store/slices/call.slice";
import { NavigateBarButton } from "../NavigateBarButton/NavigateBarButton";
import { ConferenceLauncher } from "../ConferenceLauncher/ConferenceLauncher";
import styles from "./NavigateBar.module.css";

export function NavigateBar() {
	const navigate = useNavigate();
	const location = useLocation();
	const dispatch = useDispatch<AppDispatch>();
	const requests = useSelector(
		(s: RootState) =>
			s.friend.incomingRequests.length + s.friend.outgoingRequests.length,
	);
	const unread = useSelector(
		(s: RootState) =>
			s.notification.notifications.filter((n) => !n.read).length,
	);
	const notificationsActive = location.pathname === "/notifications";
	return (
		<nav className={styles["navigate-bar"]} aria-label="Разделы Zvonok">
			<NavigateBarButton
				title="Личные сообщения"
				aria-label="Личные сообщения"
				aria-current={!notificationsActive ? "page" : undefined}
				onClick={() => {
					dispatch(callActions.setCallFocusMode(false));
					navigate("/");
				}}
			>
				<MessageCircle size={25} />
				<span className={styles.brand}>z</span>
				{requests > 0 && <span className={styles.badge}>{requests}</span>}
			</NavigateBarButton>
			<div className={styles.divider} />
			<NavigateBarButton
				title="Уведомления"
				aria-label="Уведомления"
				aria-current={notificationsActive ? "page" : undefined}
				onClick={() => {
					navigate("/notifications");
				}}
			>
				<Bell size={23} />
				{unread > 0 && <span className={styles.badge}>{unread}</span>}
			</NavigateBarButton>
			<ConferenceLauncher />
			<div className={styles.wordmark} aria-hidden="true">
				Z
			</div>
		</nav>
	);
}
