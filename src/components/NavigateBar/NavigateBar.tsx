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
import { SettingsIcon } from "lucide-react";
import { ConferenceLauncher } from "../ConferenceLauncher/ConferenceLauncher";
import { resolveMediaUrl } from "../../utils/mediaUrl";

const messageNavIconUrl = `${import.meta.env.BASE_URL}message-nav-icon.png`;
const notifyIconUrl = `${import.meta.env.BASE_URL}notify-icon.png`;

export function NavigateBar({ servers }: NavigateBarProps) {
	const navigate = useNavigate();
	const dispatch = useDispatch<AppDispatch>();
	const friend = useSelector((s: RootState) => s.friend);
	const { notifications } = useSelector((s: RootState) => s.notification);
	const username = useSelector((s: RootState) => s.user.myUser?.username);
	const displayName = useSelector((s: RootState) => s.user.myUser?.displayName);
	const avatarUrl = useSelector((s: RootState) => s.user.myUser?.avatarUrl);
	const [isSettingModalOpen, setIsSettingModalOpen] = useState<boolean>(false);

	const requestsCount = friend.incomingRequests.length + friend.outgoingRequests.length;
	const unreadNotification = notifications.filter(n => n.read === false).length;
	const avatarBg = StringToColor(username);
	const resolvedAvatarUrl = resolveMediaUrl(avatarUrl);

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
				<img src={messageNavIconUrl} />
				{requestsCount > 0 && (
					<span className={styles["messages-badge"]}></span>
				)}
			</NavigateBarButton>
		</div>

		<div className={styles["divider"]} />

		<div className={styles["middle"]}>
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
				<img src={notifyIconUrl} />

				{unreadNotification > 0 && (
					<span className={styles["messages-badge"]}/>
				)}
			</NavigateBarButton>

			<ConferenceLauncher />

			<NavigateBarButton onClick={() => setIsSettingModalOpen(true)}>
				<SettingsIcon color="white" size={28} />
			</NavigateBarButton>

			<div className={styles["user"]} onClick={() => null} style={!resolvedAvatarUrl ? { backgroundColor: avatarBg } : undefined}>
				{!!resolvedAvatarUrl ? (
					<img src={resolvedAvatarUrl} alt="avatar" />
				) : (
					<div>{(displayName?.[0] || "U").toUpperCase()}</div>
				)}
			</div>
		</div>
		{<SettingModal isOpen={isSettingModalOpen} onClose={() => setIsSettingModalOpen(false)} />}
	</div >
}
