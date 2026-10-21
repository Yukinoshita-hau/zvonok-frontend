import { UserMinus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import styles from "./FriendListItem.module.css";
import type { FriendListItemProps } from "./FriendListItem.props";
import type { AppDispatch, RootState } from "../../store/store";
import { friendActions } from "../../store/slices/friend.slice";
import { StringToColor } from "../../utils/stringHelpers";
import { resolveMediaUrl } from "../../utils/mediaUrl";

export function FriendListItem({ friend, onClick }: FriendListItemProps) {
	const dispatch = useDispatch<AppDispatch>();

	const normalizedUser = useSelector(
		(s: RootState) => s.users.byId[friend.friendId],
	);

	const username = normalizedUser?.username ?? friend.friendUsername;
	const displayName = normalizedUser?.displayName ?? friend.friendDisplayName;
	const avatarUrl = normalizedUser?.avatarUrl ?? friend.friendAvatarUrl;
	const resolvedAvatarUrl = resolveMediaUrl(avatarUrl);

	const avatarBg = StringToColor(username);

	const removeHandle = () => {
		if (!window.confirm(`Удалить ${displayName || username} из друзей?`)) return;
		dispatch(friendActions.removeFriend({ friendUsername: username }));
	};

	return (
		<div className={styles["item"]}>
			<button
				className={styles["open-chat"]}
				aria-label={`Открыть переписку с ${displayName}`}
				onClick={() => onClick(friend.friendId)}
			>
				<div className={styles["avatar-wrapper"]}>
					<div className={styles["avatar"]} style={{ background: avatarBg }}>
						{resolvedAvatarUrl ? (
							<img src={resolvedAvatarUrl} alt="" />
						) : (
							<div>{(displayName?.[0] || "?").toUpperCase()}</div>
						)}
					</div>
					<span
						className={
							(normalizedUser?.status ?? friend.friendStatus) === "ONLINE"
								? styles["status-online"]
								: styles["status-offline"]
						}
					/>
				</div>

				<div className={styles["content"]}>
					<div className={styles["title-row"]}>
						<span className={styles["title"]} title={username}>
							{displayName ?? "Unknown"}
						</span>
						<small className={styles["presence"]}>
							{(normalizedUser?.status ?? friend.friendStatus) === "ONLINE"
								? "В сети"
								: "Не в сети"}
						</small>
					</div>
				</div>
			</button>
			<button
				className={styles["remove-friend-btn"]}
				aria-label={`Удалить из друзей ${displayName}`}
				title="Удалить из друзей"
				onClick={(e) => {
					e.stopPropagation();
					removeHandle();
				}}
			>
				<UserMinus size={17} />
			</button>
		</div>
	);
}
