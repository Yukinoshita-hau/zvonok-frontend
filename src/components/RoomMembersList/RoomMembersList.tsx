import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styles from "./RoomMembersList.module.css";
import type { RoomMembersListProps } from "./RoomMembersList.props";
import { StringToColor } from "../../utils/stringHelpers";
import { UserMiniCard } from "../UserMiniCard/UserMiniCard";
import type { RootState, AppDispatch } from "../../store/store";
import { friendActions } from "../../store/slices/friend.slice";
import type { UserCardRelationship } from "../UserMiniCard/UserMiniCard.props";

const STATUS_LABEL: Record<string, string> = {
	ONLINE: "Online",
	OFFLINE: "Offline",
	AWAY: "Away",
	BUSY: "Busy",
	INVISIBLE: "Invisible"
};

export function RoomMembersList({ members, myUserId }: RoomMembersListProps) {
	const dispatch = useDispatch<AppDispatch>();
	const { friends, incomingRequests, outgoingRequests } = useSelector((s: RootState) => s.friend);
	const [activeMemberId, setActiveMemberId] = useState<number | null>(null);
	const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

	const activeMember = useMemo(() => members.find((member) => member.id === activeMemberId) ?? null, [activeMemberId, members]);

	const getRelationship = (username: string, memberId: number): UserCardRelationship => {
		if (memberId === myUserId) return "self";
		if (friends.some((friend) => friend.friendUsername === username)) return "friend";
		if (outgoingRequests.some((request) => request.receiverUsername === username)) return "outgoing";
		if (incomingRequests.some((request) => request.senderUsername === username)) return "incoming";
		return "none";
	};

	const handleOpenMember = (event: React.MouseEvent<HTMLButtonElement>, memberId: number) => {
		setAnchorRect(event.currentTarget.getBoundingClientRect());
		setActiveMemberId(memberId);
	};

	return (
		<div className={styles["members-list"]}>
			{members.map((member) => {
				const isMe = member.id === myUserId;
				const statusLabel = STATUS_LABEL[member.status] ?? member.status;
				const avatarBg = StringToColor(member.username);

				return (
					<button
						key={member.id}
						type="button"
						className={styles["member-item"]}
						onClick={(event) => handleOpenMember(event, member.id)}
					>
						<div className={styles["member-avatar"]} style={!member.avatarUrl ? { backgroundColor: avatarBg } : undefined}>
							{member.avatarUrl ? (
								<img src={member.avatarUrl} crossOrigin="anonymous" alt={member.displayName} />
							) : (
								member.username.slice(0, 1).toUpperCase()
							)}
						</div>
						<div className={styles["member-main"]}>
							<div className={styles["member-name"]}>
								{member.displayName}
								{isMe && <span className={styles["member-you"]}>you</span>}
							</div>
							<div className={styles["member-status"]}>{statusLabel}</div>
						</div>
					</button>
				);
			})}

			{activeMember && (
				<UserMiniCard
					isOpen
					displayName={activeMember.displayName}
					username={activeMember.username}
					avatarUrl={activeMember.avatarUrl}
					avatarBg={StringToColor(activeMember.username)}
					statusLabel={STATUS_LABEL[activeMember.status] ?? activeMember.status}
					relationship={getRelationship(activeMember.username, activeMember.id)}
					anchorRect={anchorRect}
					aboutMe={null}
					onClose={() => setActiveMemberId(null)}
					onAddFriend={() => {
						dispatch(friendActions.sendFriendRequest({ username: activeMember.username }));
						setActiveMemberId(null);
					}}
					onRemoveFriend={() => {
						dispatch(friendActions.removeFriend({ friendUsername: activeMember.username }));
						setActiveMemberId(null);
					}}
				/>
			)}
		</div>
	);
}
