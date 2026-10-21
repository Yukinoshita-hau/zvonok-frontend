import { MessageCircle, UserCheck, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useModalFocus } from '../../hooks/useModalFocus';
import { SettingModal } from '../SettingModal/SettingModal';
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
	const wsStatus = useSelector((state: RootState) => state.websocket.status);
	const pendingRequestId = useSelector((state: RootState) => state.friend.incomingRequests.find(request => request.senderId === userId)?.requestId);
	const [editing, setEditing] = useState(false);
	const modalRef = useModalFocus(isOpen, onClose);
	const isSelf = userId != null && userId === myUser?.id;
	const { profile, status, error, reload } = useUserMiniProfile(userId, isOpen && !isSelf);

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
	const incomingRequestId = profile?.incomingRequestId ?? fallbackUser?.incomingRequestId ?? pendingRequestId ?? null;
	const canRenderFallback = Boolean(username || fallbackUser?.displayName || isSelf);

	const statusText = useMemo(() => {
		if (isSelf) return wsStatus === 'connected' ? 'В сети · Это вы' : 'Нет связи с сервером · Это вы';
		if (status === "loading") return "Загружаем статус…";
		if (profile?.status === "ONLINE") return "В сети";
		if (profile?.lastSeenAt) {
			return `Был(а): ${formatDateTime(profile.lastSeenAt)}`;
		}

		return status === "failed" ? "Краткий профиль" : "Не в сети";
	}, [isSelf, wsStatus, profile?.lastSeenAt, profile?.status, status]);

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
		<div className={styles.backdrop} onClick={event => {event.stopPropagation();onClose();}}>
			<div ref={modalRef} role="dialog" aria-modal="true" aria-label="Профиль пользователя" tabIndex={-1} className={styles.modal} onClick={(event) => event.stopPropagation()}>
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
						<button onClick={() => void reload()}>Повторить</button>
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
							<span data-online={isSelf ? wsStatus === 'connected' : profile?.status === "ONLINE"} />
							{statusText}
						</div>

						{status === "failed" && (
							<p className={styles.about} role="alert">Не удалось загрузить полный профиль. <button onClick={() => void reload()}>Повторить</button></p>
						)}

						{(isSelf ? myUser?.aboutMe : profile?.bio || profile?.about) && (
							<p className={styles.about}>{isSelf ? myUser?.aboutMe : profile?.bio ?? profile?.about}</p>
						)}

						<div className={styles.actions}>
							{friendshipStatus === "SELF" && (
								<button type="button" className={styles.secondaryButton} onClick={() => setEditing(true)}>
									Редактировать профиль
								</button>
							)}

							{profile && friendshipStatus === "NOT_FRIENDS" && username && (
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
			<SettingModal isOpen={editing} onClose={() => { setEditing(false); onClose(); }} />
		</div>,
		document.body,
	);
}
