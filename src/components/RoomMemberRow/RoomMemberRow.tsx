import { StringToColor } from "../../utils/stringHelpers";
import styles from "./RoomMemberRow.module.css";
import type { RoomMemberRowProps } from "./RoomMemberRow.props";

const STATUS_LABEL: Record<string, string> = {
	ONLINE: "Online",
	OFFLINE: "Offline",
	AWAY: "Away",
	BUSY: "Busy",
	INVISIBLE: "Invisible",
};

export function RoomMemberRow({ member, isCurrentUser, onClick }: RoomMemberRowProps) {
	const username = member.username || `user-${member.id}`;
	const displayName = member.displayName || username;
	const status = member.status ?? "OFFLINE";
	const statusLabel = STATUS_LABEL[status] ?? status;
	const statusClass = styles[`status-${status.toLowerCase()}`] ?? styles["status-offline"];
	const avatarBg = StringToColor(username || displayName || String(member.id));

	return (
		<button type="button" className={styles["member-item"]} onClick={onClick}>
			<div className={styles["member-avatar"]} style={!member.avatarUrl ? { backgroundColor: avatarBg } : undefined}>
				{member.avatarUrl ? (
					<img src={member.avatarUrl} crossOrigin="anonymous" alt={`${displayName} avatar`} />
				) : (
					<span>{displayName.slice(0, 1).toUpperCase()}</span>
				)}
			</div>

			<div className={styles["member-main"]}>
				<div className={styles["member-name-row"]}>
					<div className={styles["member-display-name"]} title={displayName}>{displayName}</div>
					{isCurrentUser && <span className={styles["member-you"]}>you</span>}
				</div>
				<div className={styles["member-username"]} title={`@${username}`}>@{username}</div>
			</div>

			<div className={styles["member-status"]} title={statusLabel}>
				<span className={[styles["status-dot"], statusClass].join(" ")} />
				<span>{statusLabel}</span>
			</div>
		</button>
	);
}
