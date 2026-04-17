import { useNavigate } from "react-router-dom";
import styles from "./RoomListItem.module.css";
import type { RoomListItemProps } from "./RoomListItem.props";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { formatTime } from "../../utils/timeHelpers";

export function RoomListItem({ room }: RoomListItemProps) {
	const navigate = useNavigate();
	const myUser = useSelector((s: RootState) => s.user.myUser);

	return (
				<button
					className={styles["item"]}
					onClick={() => navigate(`/dm?roomId=${room.id}`)}
				>
					<div className={styles["avatar-wrapper"]}>
						<div className={styles["avatar"]}>
							{room.type === "PRIVATE" ? "👤" : "👥"}
						</div>
						<span className={styles["status-dot"]} />
					</div>

					<div className={styles["content"]}>
						<div className={styles["title-row"]}>
							<span className={styles["title"]}>
								{room.name ?? room.members?.find(member =>
									member.id !== myUser?.id
								)?.username ?? "Unknown"}
							</span>
							<div className={styles["right-side"]}>
								{room.unreadCount > 0 && (
									<span className={styles["unread-badge"]}>
										{room.unreadCount > 99 ? "99+" : room.unreadCount}
									</span>
								)}
							</div>
							<span className={styles["time"]}>
								{formatTime(room.lastActivityAt)}
							</span>
						</div>
						<div className={styles["message-preview"]}>
							{room.lastMessageContent || "No messages yet..."}
						</div>
					</div>
				</button>
	)	
}
