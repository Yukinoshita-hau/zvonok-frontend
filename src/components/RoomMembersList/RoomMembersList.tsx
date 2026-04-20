import styles from "./RoomMembersList.module.css";
import type { RoomMembersListProps } from "./RoomMembersList.props";

const STATUS_LABEL: Record<string, string> = {
	ONLINE: "Online",
	OFFLINE: "Offline",
	AWAY: "Away",
	BUSY: "Busy",
	INVISIBLE: "Invisible"
};

export function RoomMembersList({ members, myUserId }: RoomMembersListProps) {
	return (
		<div className={styles["members-list"]}>
			{members.map((member) => {
				const isMe = member.id === myUserId;
				const statusLabel = STATUS_LABEL[member.status] ?? member.status;

				return (
					<div key={member.id} className={styles["member-item"]}>
						<div className={styles["member-avatar"]}>
							{member.username.slice(0, 1).toUpperCase()}
						</div>
						<div className={styles["member-main"]}>
							<div className={styles["member-name"]}>
								{member.username}
								{isMe && <span className={styles["member-you"]}>вы</span>}
							</div>
							<div className={styles["member-status"]}>{statusLabel}</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
