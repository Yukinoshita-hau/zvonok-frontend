import type { FriendRequest } from "../../api/interfaces/FriendRequest";
import type { FriendRequestsListProps } from "./FriendRequestsList.props";
import styles from "./FriendRequestsList.module.css"
import cn from "classnames";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../store/store";
import { friendActions } from "../../store/slices/friend.slice";
import { StringToColor } from "../../utils/stringHelpers";


export function FriendRequestsList({ requestsList, mode }: FriendRequestsListProps) {
	const dispatch = useDispatch<AppDispatch>();

	const acceptHandle = (requestId: number) => {
		dispatch(friendActions.acceptFriendRequest({ requestId: requestId }));
	}

	const rejectHandle = (requestId: number) => {
		dispatch(friendActions.rejectFriendRequest({ requestId: requestId }));
	}

	const cancelHandle = (requestId: number) => {
		dispatch(friendActions.cancelFriendRequest({ requestId: requestId }));
	}

	return (
		<div className={styles["request-list"]}>
			{
				requestsList.map((r: FriendRequest) => (
					<div className={styles["request"]} key={r.requestId}>
						<div className={styles["info"]}>
							<div className={styles["avatar"]} style={!r.senderAvatarUrl ? { backgroundColor: StringToColor(r.senderUsername) } : undefined}>
								{r.senderAvatarUrl ? (
									<img src={r.senderAvatarUrl} crossOrigin="anonymous" />
								) : (
									<div>{(r.senderDisplayName?.[0] || "?").toUpperCase()}</div>
								)}
							</div>
							<div className={styles["meta"]}>
								<div className={styles["username"]}>{mode === "incoming" ? r.senderUsername : r.receiverUsername}</div>
								<div className={styles["date"]}>{new Date(r.createdAt).toLocaleDateString()}</div>
							</div>
						</div>

						<div className={styles["actions"]}>
							{mode === "incoming" ? (
								<>
									<button className={cn(styles["btn"], styles["btn-accept"])} onClick={() => acceptHandle(r.requestId)}>Принять</button>
									<button className={cn(styles["btn"], styles["btn-cancel"])} onClick={() => rejectHandle(r.requestId)}>Отклонить</button>
								</>
							) : (

								<button className={cn(styles["btn"], styles["btn-cancel"])} onClick={() => cancelHandle(r.requestId)}>Отменить</button>
							)}
						</div>
					</div>
				))
			}
		</div>
	)
}
