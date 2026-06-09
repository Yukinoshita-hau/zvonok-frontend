import { useNavigate } from "react-router-dom";
import styles from "./RoomListItem.module.css";
import type { RoomListItemProps } from "./RoomListItem.props";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { formatTime } from "../../utils/timeHelpers";
import { StringToColor } from "../../utils/stringHelpers";

export function RoomListItem({ room }: RoomListItemProps) {
	const navigate = useNavigate();

	const myUser = useSelector((s: RootState) => s.user.myUser);
	const usersById = useSelector((s: RootState) => s.users.byId);

	const isPrivateRoom = room.type === "PRIVATE";

	const interlocutorId = isPrivateRoom
		? room.memberIds.find((memberId) => memberId !== myUser?.id)
		: null;

	const interlocutor = interlocutorId
		? usersById[interlocutorId] ?? null
		: null;

	const title = isPrivateRoom
		? interlocutor?.displayName || "Unknown"
		: room.name || "Unknown";

	const avatarSrc = isPrivateRoom
		? interlocutor?.avatarUrl ?? null
		: room.avatarUrl ?? null;

	const avatarFallback = isPrivateRoom
		? (interlocutor?.displayName?.[0] || "?").toUpperCase()
		: (room.name?.[0] || "?").toUpperCase();

	const avatarColorKey = isPrivateRoom
		? interlocutor?.username || "unknown-user"
		: room.name || "unknown-room";

	const avatarBg = StringToColor(avatarColorKey);

	return (
		<button
			className={styles["item"]}
			onClick={() => navigate(`/dm?roomId=${room.id}`)}
		>
			<div className={styles["avatar-wrapper"]}>
				<div
					className={styles["avatar"]}
					style={!avatarSrc ? { backgroundColor: avatarBg } : undefined}
				>
					{avatarSrc ? (
						<img
							src={avatarSrc}
							alt={title}
							crossOrigin="anonymous"
							className={styles["avatar-image"]}
						/>
					) : (
						<div className={styles["avatar-fallback"]}>
							{avatarFallback}
						</div>
					)}
				</div>

				{isPrivateRoom && <span className={interlocutor?.status === "ONLINE" ? styles["status-online"]: styles["status-offline"]} />}
			</div>

			<div className={styles["content"]}>
				<div className={styles["title-row"]}>
					<span className={styles["title"]}>{title}</span>

					<div className={styles["right-side"]}>
						{room.unreadCount > 0 && (
							<span className={styles["unread-badge"]}>
								{room.unreadCount > 99 ? "99+" : room.unreadCount}
							</span>
						)}

						<span className={styles["time"]}>
							{formatTime(room.lastActivityAt)}
						</span>
					</div>
				</div>

				<div className={styles["message-preview"]}>
					{room.lastMessageContent || "No messages yet..."}
				</div>
			</div>
		</button>
	);
}
