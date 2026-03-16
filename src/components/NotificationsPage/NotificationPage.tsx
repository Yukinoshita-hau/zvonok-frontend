import { useNavigate } from "react-router-dom";
import styles from "./NotificationPage.module.css";
import cn from "classnames";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import type { Notification } from "../../store/interfaces/notification.interface";
import { notificationAction } from "../../store/slices/notification.slice";

export function NotificationsPage() {
	const navigate = useNavigate();
	const { notifications } = useSelector((s: RootState) => s.notification);
	const dispatch = useDispatch<AppDispatch>();

	const handleClick = (n: Notification) => {
		switch (n.target.type) {
			case "CHAT": {
				navigate(`/dm/${n.target.roomId}`);
				break;
			}
			case "FRIEND_REQUESTS": {
				navigate("/");
				break;
			}
			case "FRIEND_PROFILE": {
				navigate(`/users/${n.target.username}`);
				break;
			}
			case "CALL_HISTORY": {
				navigate("/calls");
				break;
			}
			case "SYSTEM": {
				break;
			}
		}
		dispatch(notificationAction.markAsRead({ id: n.id }))
	}

	return (
		<div className={styles["notification-page"]}>
			<div className={styles["header"]}>
				<h2 className={styles["header-title"]}>Notifications</h2>
				<span className={styles["header-count"]}>
					{notifications.length} total
				</span>
			</div>

			{notifications.length === 0 ? (
				<div className={styles["empty"]}>
					No notifications yet
				</div>
			) : (
				<div className={styles["list"]}>
					{notifications.map((n) => (
						<button
							key={n.id}
							className={cn(styles["item"], {
								[styles["unread"]]: !n.read,
							})}
							onClick={() => handleClick(n)}
						>
							<div className={styles["item-header"]}>
								<span className={styles["title"]}>{n.title}</span>
								<span className={styles["time"]}>{n.createdAt}</span>
							</div>
							<div className={styles["message"]}>{n.message}</div>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
