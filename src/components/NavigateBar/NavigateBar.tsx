import { useNavigate } from "react-router-dom";
import styles from "./NavigateBar.module.css";
import { ServerButton } from "../ServerButton/ServerButton";
import type { NavigateBarProps } from "./NavigateBar.props";
import { NavigateBarButton } from "../NavigateBarButton/NavigateBarButton";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { notificationAction } from "../../store/slices/notification.slice";
import { useState } from "react";
import { SettingModal } from "../SettingModal/SettingModal";
import { callActions } from "../../store/slices/call.slice";
import { StringToColor } from "../../utils/stringHelpers";

export function NavigateBar({ servers }: NavigateBarProps) {
	const navigate = useNavigate();
	const dispatch = useDispatch<AppDispatch>();
	const friend = useSelector((s: RootState) => s.friend);
	const { notifications } = useSelector((s: RootState) => s.notification);
	const username = useSelector((s: RootState) => s.user.myUser?.username);
	const avatarUrl = useSelector((s: RootState) => s.user.myUser?.avatarUrl);
	const [isSettingModalOpen, setIsSettingModalOpen] = useState<boolean>(false);

	const requestsCount = friend.incomingRequests.length + friend.outgoingRequests.length;
	const unreadNotification = notifications.filter(n => n.read === false).length;
	const avatarBg = StringToColor(username);

	const goToDM = () => {
		dispatch(callActions.setCallFocusMode(false))
		navigate("/");
	}

	const notificationHandle = () => {
		dispatch(notificationAction.markAllIsRead());
		navigate("/notifications")
	}

	return <div className={styles["navigate-bar"]}>
		<div className={styles["top"]}>
			<NavigateBarButton onClick={goToDM}>
				<img src="../../../public/message-nav-icon.png" />
				{requestsCount > 0 && (
					<span className={styles["messages-badge"]}></span>
				)}
			</NavigateBarButton>
		</div>

		<div className={styles["divider"]} />

		<div className={styles["middle"]}>
			<NavigateBarButton onClick={() => navigate("/my-servers")}>
				<img src="../../../public/server-all-list-icon.png" />
			</NavigateBarButton>
			{servers.map((server, index) => (
				<ServerButton
					key={server.id}
					index={index}
					server={server}
					onClick={() => navigate(`/server/${server.id}`)}
				/>
			))}
		</div>

		<div className={styles["bottom"]}>
			<NavigateBarButton onClick={notificationHandle}>
				<img src="../../../public/notify-icon.png" />

				{unreadNotification > 0 && (
					<span className={styles["messages-badge"]}/>
				)}
			</NavigateBarButton>
			<div className={styles["user"]} onClick={() => setIsSettingModalOpen(true)} style={!avatarUrl ? { backgroundColor: avatarBg } : undefined}>
				{!!avatarUrl ? (
					<img src={avatarUrl} crossOrigin="anonymous" alt="avatar" />
				) : (
					<div>{(username?.[0] || "U").toUpperCase()}</div>
				)}
			</div>
		</div>
		{<SettingModal isOpen={isSettingModalOpen} onClose={() => setIsSettingModalOpen(false)} />}
	</div >
}
