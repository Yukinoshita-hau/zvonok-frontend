import { MessageCircle, UserCheck, UserPlus, X } from "lucide-react";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useUserMiniProfile } from "../../hooks/useUserMiniProfile";
import { friendActions } from "../../store/slices/friend.slice";
import type { AppDispatch, RootState } from "../../store/store";
import { formatDateTime } from "../../utils/timeHelpers";
import { StringToColor } from "../../utils/stringHelpers";
import { resolveMediaUrl } from "../../utils/mediaUrl";
import styles from "./UserMiniProfileModal.module.css";
import type { UserMiniProfileModalProps } from "./UserMiniProfileModal.props";

export function UserMiniProfileModal({
	userId,
	isOpen,
	onClose,
	fallbackUser,
}: UserMiniProfileModalProps) {
	const dispatch = useDispatch<AppDispatch>();
	const navigate = useNavigate();
	const myUser = useSelector((state: RootState) => state.user.myUser);
	const isSelf = userId != null && userId === myUser?.id;
	const { profile, status, error } = useUserMiniProfile(userId, isOpen && !isSelf);

	const username = profile?.username ?? fallbackUser?.username ?? (isSelf ? myUser?.username : null);
	const displayName =
		profile?.displayName ??
		fallbackUser?.displayName ??
		(isSelf ? myUser?.displayName : null) ??
		username ??
		"Пользователь";
	const avatarUrl = profile?.avatarUrl ?? fallbackUser?.avatarUrl ?? (isSelf ? myUser?.avatarUrl : null);
	const resolvedAvatarUrl = resolveMediaUrl(avatarUrl);
	const friendshipStatus = profile?.friendshipStatus ?? (isSelf ? "SELF" : "NOT_FRIENDS");
	const incomingRequestId = profile?.incomingRequestId ?? fallbackUser?.incomingRequestId ?? null;
	const canRenderFallback = Boolean(username || displayName);

	const statusText = useMemo(() => {
		if (isSelf) return "Это вы";
		if (profile?.status === "ONLINE") return "В сети";
		if (profile?.lastSeenAt) {
			return `Был(а): ${formatDateTime(profile.lastSeenAt)}`;
		}

		return status === "failed" ? "Краткий профиль" : "Не в сети";
	}, [isSelf, profile?.lastSeenAt, profile?.status, status]);

	if (!isOpen || !userId) return null;

	const handleSendFriendRequest = () => {
		if (!username) return;
		dispatch(friendActions.sendFriendRequest({ username }));
		onClose();
	};

	const handleAcceptFriendRequest = () => {
		if (!incomingRequestId) return;
		dispatch(friendActions.acceptFriendRequest({ requestId: incomingRequestId }));
		onClose();
	};

	const handleOpenChat = () => {
		if (!profile?.privateRoomId) return;

		navigate(`/dm?roomId=${profile.privateRoomId}`);
		onClose();
	};

	return createPortal(
		<div className={styles.backdrop} onClick={onClose}>
			<div className={styles.modal} onClick={(event) => event.stopPropagation()}>
				<button
					type="button"
					className={styles.closeButton}
					onClick={onClose}
					aria-label="Закрыть"
				>
					<X size={18} />
				</button>

				{status === "loading" && !canRenderFallback && (
					<div className={styles.state}>Загружаем профиль...</div>
				)}

				{status === "failed" && !canRenderFallback && (
					<div className={styles.state}>
						{error ?? "Не удалось загрузить профиль"}
						<span>Backend вернул ошибку mini-profile.</span>
					</div>
				)}

				{(profile || canRenderFallback) && (
					<>
						<div className={styles.header}>
							<div
								className={styles.avatar}
								style={{ backgroundColor: StringToColor(username ?? displayName) }}
							>
								{resolvedAvatarUrl ? (
									<img src={resolvedAvatarUrl} alt={displayName} />
								) : (
									<span>{displayName[0]?.toUpperCase()}</span>
								)}
							</div>

							<div className={styles.identity}>
								<h3>{displayName}</h3>
								{username && <span>@{username}</span>}
							</div>
						</div>

						<div className={styles.statusRow}>
							<span data-online={profile?.status === "ONLINE"} />
							{statusText}
						</div>

						{status === "failed" && (
							<p className={styles.about}>
								Полный профиль сейчас недоступен: backend возвращает неуникальный результат.
								Основные действия оставлены доступными.
							</p>
						)}

						{(profile?.bio || profile?.about) && (
							<p className={styles.about}>{profile.bio ?? profile.about}</p>
						)}

						<div className={styles.actions}>
							{friendshipStatus === "SELF" && (
								<button type="button" className={styles.secondaryButton} disabled>
									Это вы
								</button>
							)}

							{friendshipStatus === "NOT_FRIENDS" && username && (
								<button
									type="button"
									className={styles.primaryButton}
									onClick={handleSendFriendRequest}
								>
									<UserPlus size={16} />
									Добавить
								</button>
							)}

							{friendshipStatus === "REQUEST_SENT" && (
								<button type="button" className={styles.secondaryButton} disabled>
									Заявка отправлена
								</button>
							)}

							{friendshipStatus === "REQUEST_RECEIVED" && (
								<button
									type="button"
									className={styles.primaryButton}
									disabled={!incomingRequestId}
									onClick={handleAcceptFriendRequest}
								>
									<UserCheck size={16} />
									Принять заявку
								</button>
							)}

							{friendshipStatus === "FRIENDS" && (
								<button
									type="button"
									className={styles.primaryButton}
									disabled={!profile?.privateRoomId}
									onClick={handleOpenChat}
								>
									<MessageCircle size={16} />
									Открыть чат
								</button>
							)}
						</div>
					</>
				)}
			</div>
		</div>,
		document.body,
	);
}
