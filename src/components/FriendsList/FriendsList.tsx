import styles from "./FriendsList.module.css";
import type { FriendsListProps } from "./FriendsList.props";


export function FriendsList({ friends, onClick }: FriendsListProps) {

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
				<button
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
						</div>
					</div>
				</button>
			))}
		</div>
	)
}
