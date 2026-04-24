import type { RoomsListProps } from "./RoomsList.props";
import styles from "./RoomsList.module.css";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { formatTime } from "../../utils/timeHelpers";

export function RoomsList({ rooms }: RoomsListProps) {
	const navigate = useNavigate();
	const { myUser } = useSelector((s: RootState) => s.user)
	const usersById = useSelector((s: RootState) => s.users.usersById);

	if (rooms.length === 0) {
		return (
			<div className={styles["empty"]}>
				No message yet
			</div>
		)
	}

	return (
		<div className={styles["list"]}>
			{rooms.map(room => (
				<button
					key={room.id}
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
								{room.name ?? room.memberIds
									.map((memberId) => usersById[memberId])
									.find((member) => member?.id !== myUser?.id)?.username ?? "Unknown"}
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
			))}
		</div>
	)
}
