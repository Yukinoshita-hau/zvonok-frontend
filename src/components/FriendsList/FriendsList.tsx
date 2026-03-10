import { useDispatch } from "react-redux";
import styles from "./FriendsList.module.css";
import type { FriendsListProps } from "./FriendsList.props";
import type { AppDispatch } from "../../store/store";
import { friendActions } from "../../store/slices/friend.slice";

export function FriendsList({ friends, onClick }: FriendsListProps) {
	const dispatch = useDispatch<AppDispatch>();

	const removeHandle = (username: string) => {
		dispatch(friendActions.removeFriend({ friendUsername: username }))
	}

	if (friends.length === 0) {
		return (
			<div className={styles["empty"]}>
				you don't have friends((
			</div>
		)
	}

	return (
		<div className={styles["list"]}>
			{friends.map(friend => (
				<div
					key={friend.friendId}
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
			))}
		</div>
	)
}
