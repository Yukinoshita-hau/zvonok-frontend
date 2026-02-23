import styles from "./FriendsList.module.css";
import { useNavigate } from "react-router-dom";
import type { FriendsListProps } from "./FriendsList.props";
import type { RootState } from "../../store/store";
import { useSelector } from "react-redux";


export function FriendsList({ friends }: FriendsListProps) {
	const navigate = useNavigate();
	const { myUser } = useSelector((s: RootState) => s.user)

	if (friends.length === 0) {
		return (
			<div className={styles["empty"]}>
				you don't have friends((
			</div>
		)
	}

	return (
		<></>
	)
}
