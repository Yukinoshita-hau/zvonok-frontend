import { useDispatch, useSelector } from "react-redux";
import styles from "./FriendListItem.module.css";
import type { FriendListItemProps } from "./FriendListItem.props";
import type { AppDispatch, RootState } from "../../store/store";
import { friendActions } from "../../store/slices/friend.slice";
import { StringToColor } from "../../utils/stringHelpers";

export function FriendListItem({ friend, onClick }: FriendListItemProps) {
	const dispatch = useDispatch<AppDispatch>();

	const normalizedUser = useSelector((s: RootState) =>
		s.users.byId[friend.friendId]
	);

	const username = normalizedUser?.username ?? friend.friendUsername;
	const displayName = normalizedUser?.displayName ?? friend.friendDisplayName;
	const avatarUrl = normalizedUser?.avatarUrl ?? friend.friendAvatarUrl;

	const avatarBg = StringToColor(username);

	const removeHandle = () => {
		dispatch(friendActions.removeFriend({ friendUsername: username }));
	};

	return (
		<div
			className={styles["item"]}
			onClick={() => onClick(friend.friendId)}
		>
			<div className={styles["avatar-wrapper"]}>
				<div className={styles["avatar"]} style={{ background: avatarBg }}>
					{avatarUrl ? (
						<img src={avatarUrl} crossOrigin="anonymous" />
					) : (
						<div>{(displayName?.[0] || "?").toUpperCase()}</div>
					)}
				</div>
				<span className={normalizedUser?.status === "ONLINE" ? styles["status-online"]: styles["status-offline"]} />
			</div>

			<div className={styles["content"]}>
				<div className={styles["title-row"]}>
					<span className={styles["title"]}>
						{displayName ?? "Unknown"}
					</span>

					<button
						className={styles["remove-friend-btn"]}
						onClick={(e) => {
							e.stopPropagation();
							removeHandle();
						}}
					>
						<img src="/cross-icon.svg" />
					</button>
				</div>
			</div>
		</div>
	);
}
