import { useDispatch } from "react-redux";
import styles from "./FriendListItem.module.css";
import type { FriendListItemProps } from "./FriendListItem.props";
import type { AppDispatch } from "../../store/store";
import { friendActions } from "../../store/slices/friend.slice";

export function FriendListItem({ friend, onClick }: FriendListItemProps) {
	const dispatch = useDispatch<AppDispatch>();

	const removeHandle = (username: string) => {
		dispatch(friendActions.removeFriend({ friendUsername: username }))
	}

	return (
		<div
			className={styles["item"]}
			onClick={() => onClick(friend.friendUsername)}
		>
			<div className={styles["avatar-wrapper"]}>
				<div className={styles["avatar"]}>
					{}
				</div>
				<span className={styles["status-dot"]} />
			</div>

			<div className={styles["content"]}>
				<div className={styles["title-row"]}>
					<span className={styles["title"]}>
						{friend.friendUsername ?? "Unknown"}
					</span>
					<button className={styles["remove-friend-btn"]}
						onClick={(e) => {
							e.stopPropagation();
							removeHandle(friend.friendUsername);
						}}>
						<img src="../../../public/cross-icon.svg" />
					</button>
				</div>
			</div>
		</div>
	)
}
