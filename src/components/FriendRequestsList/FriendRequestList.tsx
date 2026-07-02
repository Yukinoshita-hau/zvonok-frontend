import cn from "classnames";
import { useState } from "react";
import { useDispatch } from "react-redux";
import type { FriendRequest } from "../../api/interfaces/FriendRequest";
import { friendActions } from "../../store/slices/friend.slice";
import type { AppDispatch } from "../../store/store";
import { formatDate } from "../../utils/timeHelpers";
import { StringToColor } from "../../utils/stringHelpers";
import { resolveMediaUrl } from "../../utils/mediaUrl";
import { UserMiniProfileModal } from "../UserMiniProfileModal/UserMiniProfileModal";
import styles from "./FriendRequestsList.module.css";
import type { FriendRequestsListProps } from "./FriendRequestsList.props";

export function FriendRequestsList({ requestsList, mode }: FriendRequestsListProps) {
	const dispatch = useDispatch<AppDispatch>();
	const [profileUser, setProfileUser] = useState<{
		id: number;
		username: string;
		displayName: string;
		avatarUrl: string | null;
		incomingRequestId?: number | null;
	} | null>(null);

	const getRequestUser = (request: FriendRequest) => {
		if (mode === "incoming") {
			return {
				id: request.senderId,
				username: request.senderUsername,
				displayName: request.senderDisplayName,
				avatarUrl: request.senderAvatarUrl,
			};
		}

		return {
			id: request.receiverId,
			username: request.receiverUsername,
			displayName: request.receiverDisplayName,
			avatarUrl: request.receiverAvatarUrl,
		};
	};

	return (
		<>
			<div className={styles["request-list"]}>
				{requestsList.length === 0 && (
					<div className={styles.empty}>
						{mode === "incoming" ? "Входящих заявок нет" : "Исходящих заявок нет"}
					</div>
				)}

				{requestsList.map((request) => {
					const user = getRequestUser(request);
					const avatarUrl = resolveMediaUrl(user.avatarUrl);

					return (
						<div
							className={styles.request}
							key={request.requestId}
							role="button"
							tabIndex={0}
							onClick={() => setProfileUser({
								...user,
								incomingRequestId: mode === "incoming" ? request.requestId : null,
							})}
						>
							<div className={styles.info}>
								<div
									className={styles.avatar}
									style={{ backgroundColor: StringToColor(user.username) }}
								>
									{avatarUrl ? (
										<img src={avatarUrl} alt={user.displayName} />
									) : (
										<div>{(user.displayName?.[0] || "?").toUpperCase()}</div>
									)}
								</div>
								<div className={styles.meta}>
									<div className={styles.username}>{user.displayName}</div>
									<div className={styles.date}>{formatDate(request.createdAt)}</div>
								</div>
							</div>

							<div className={styles.actions}>
								{mode === "incoming" ? (
									<>
										<button
											className={cn(styles.btn, styles["btn-accept"])}
											onClick={(event) => {
												event.stopPropagation();
												dispatch(friendActions.acceptFriendRequest({ requestId: request.requestId }));
											}}
										>
											Принять
										</button>
										<button
											className={cn(styles.btn, styles["btn-cancel"])}
											onClick={(event) => {
												event.stopPropagation();
												dispatch(friendActions.rejectFriendRequest({ requestId: request.requestId }));
											}}
										>
											Отклонить
										</button>
									</>
								) : (
									<button
										className={cn(styles.btn, styles["btn-cancel"])}
										onClick={(event) => {
											event.stopPropagation();
											dispatch(friendActions.cancelFriendRequest({ requestId: request.requestId }));
										}}
									>
										Отменить
									</button>
								)}
							</div>
						</div>
					);
				})}
			</div>

			<UserMiniProfileModal
				userId={profileUser?.id ?? null}
				isOpen={profileUser !== null}
				fallbackUser={profileUser ?? undefined}
				onClose={() => setProfileUser(null)}
			/>
		</>
	);
}
