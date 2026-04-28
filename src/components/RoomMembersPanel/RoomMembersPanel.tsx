import type { UserMini } from "../../entities/UserMini";
import { RoomMemberRow } from "../RoomMemberRow/RoomMemberRow";
import type { RoomMembersPanelProps } from "./RoomMembersPanel.props";
import styles from "./RoomMembersPanel.module.css";

export function RoomMembersPanel({ members, myUserId, onMemberSelect }: RoomMembersPanelProps) {
	if (members.length === 0) {
		return <div className={styles["empty-state"]}>No participants in this room yet.</div>;
	}

	const sortedMembers = [...members].sort((left, right) => {
		if (left.id === myUserId) return -1;
		if (right.id === myUserId) return 1;

		return (left.displayName || left.username).localeCompare(right.displayName || right.username);
	});

	return (
		<div className={styles["members-list"]}>
			{sortedMembers.map((member: UserMini) => (
				<RoomMemberRow
					key={member.id}
					member={member}
					isCurrentUser={member.id === myUserId}
					onClick={(event) => {
						const rect = event.currentTarget.getBoundingClientRect();
						onMemberSelect(member, rect);
					}}
				/>
			))}
		</div>
	);
}
