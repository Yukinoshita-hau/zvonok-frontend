import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styles from "./FriendListItem.module.css";
import type { FriendListItemProps } from "./FriendListItem.props";
import type { AppDispatch, RootState } from "../../store/store";
import { friendActions } from "../../store/slices/friend.slice";
import { StringToColor } from "../../utils/stringHelpers";
import { UserMiniCard } from "../UserMiniCard/UserMiniCard";

export function FriendListItem({ friend, onClick }: FriendListItemProps) {
	const dispatch = useDispatch<AppDispatch>();
	const { incomingRequests, outgoingRequests } = useSelector((s: RootState) => s.friend);
	const [isProfileOpen, setIsProfileOpen] = useState(false);
	const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
	const avatarBg = StringToColor(friend.friendUsername);

	const removeHandle = () => {
		dispatch(friendActions.removeFriend({ friendUsername: friend.friendUsername }));
	};

	const openProfile = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		setAnchorRect(event.currentTarget.getBoundingClientRect());
		setIsProfileOpen(true);
	};

	const relationship = outgoingRequests.some((request) => request.receiverUsername === friend.friendUsername)
		? "outgoing"
		: incomingRequests.some((request) => request.senderUsername === friend.friendUsername)
			? "incoming"
			: "friend";

	return (
		<>
			<div
				className={styles["item"]}
				onClick={() => onClick(friend.friendUsername)}
			>
				<button type="button" className={styles["identity-button"]} onClick={openProfile}>
					<div className={styles["avatar-wrapper"]}>
						<div className={styles["avatar"]} style={{ background: avatarBg }}>
							{friend.friendAvatarUrl ? (
								<img src={friend.friendAvatarUrl} crossOrigin="anonymous" alt={friend.friendDisplayName} />
							) : (
								<div>{(friend.friendDisplayName[0] || "?").toUpperCase()}</div>
							)}
						</div>
						<span className={styles["status-dot"]} />
					</div>

					<div className={styles["content"]}>
						<div className={styles["title-row"]}>
							<span className={styles["title"]}>
								{friend.friendDisplayName ?? "Unknown"}
							</span>
						</div>
					</div>
				</button>

				<button
					className={styles["remove-friend-btn"]}
					onClick={(e) => {
						e.stopPropagation();
						removeHandle();
					}}
					aria-label={`Remove ${friend.friendDisplayName} from friends`}
				>
					<img src="../../../public/cross-icon.svg" alt="remove friend" />
				</button>
			</div>

			<UserMiniCard
				isOpen={isProfileOpen}
				displayName={friend.friendDisplayName}
				username={friend.friendUsername}
				avatarUrl={friend.friendAvatarUrl}
				avatarBg={avatarBg}
				statusLabel={friend.friendStatus}
				relationship={relationship}
				aboutMe={null}
				anchorRect={anchorRect}
				onClose={() => setIsProfileOpen(false)}
				onMessage={() => {
					onClick(friend.friendUsername);
					setIsProfileOpen(false);
				}}
				onRemoveFriend={() => {
					removeHandle();
					setIsProfileOpen(false);
				}}
			/>
		</>
	);
}
