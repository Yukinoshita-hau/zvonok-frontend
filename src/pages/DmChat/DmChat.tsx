import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./DmChat.module.css";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
	fetchRoomMessages,
	messageActions,
	sendMessageWithAttachments,
} from "../../store/slices/message.slice";
import { DmItemsList } from "../../components/DmItemsList/DmItemsList";
import { fetchMyRooms } from "../../store/slices/room.slice";
import { callActions } from "../../store/slices/call.slice";
import type { Room } from "../../entities/room";
import { Phone, Send, SettingsIcon, X, Images } from "lucide-react";
import { RoomAttachments } from '../../components/RoomAttachments/RoomAttachments';
import { RoomSettingModal } from "../../components/RoomSettingModal/RoomSettingModal";
import { StringToColor } from "../../utils/stringHelpers";
import { toastActions } from "../../store/slices/toast.slice";
import { useActiveRoomCall } from "../../hooks/useActiveRoomCall";
import { RoomActiveCallBanner } from "../../components/RoomActiveCallBanner/RoomActiveCallBanner";
import { AttachmentPicker } from "../../components/MessageAttachments/AttachmentPicker";
import { SelectedAttachmentsPreview } from "../../components/MessageAttachments/SelectedAttachmentsPreview";
import { useSelectedAttachments } from "../../hooks/useSelectedAttachments";
import { UserMiniProfileModal } from "../../components/UserMiniProfileModal/UserMiniProfileModal";
import { resolveMediaUrl } from "../../utils/mediaUrl";

import { attachmentMedia } from "../../components/MessageAttachments/playback";

import { shouldSubmitMessage } from "../../components/DmItemsList/messagePresentation";
import { readMessageDraft, writeMessageDraft } from '../../components/DmItemsList/messageDrafts';

export function DmChat({ embeddedRoomId }: { embeddedRoomId?: number }) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const dispatch = useDispatch<AppDispatch>();

	const { rooms, status: roomsStatus } = useSelector((s: RootState) => s.room);
	const { myUser } = useSelector((s: RootState) => s.user);
	const usersById = useSelector((s: RootState) => s.users.byId);
	const { replyTarget } = useSelector((s: RootState) => s.message);
	const wsStatus = useSelector((s: RootState) => s.websocket.status);
	const callStatus = useSelector((s: RootState) => s.call.status);

	const callStarting = useRef(false);
	useEffect(() => {
		if (["idle", "ended", "error"].includes(callStatus)) callStarting.current = false;
	}, [callStatus]);
	const draftKey = `${myUser?.id}:${embeddedRoomId ?? searchParams.get('roomId')}`;
	const [draft, setDraft] = useState(() => ({ key: draftKey, text: readMessageDraft(draftKey) }));
	const text = draft.key === draftKey ? draft.text : readMessageDraft(draftKey);
	const setText = (value: string) => { writeMessageDraft(draftKey, value); setDraft({ key: draftKey, text: value }); };
	const inputRef = useRef<HTMLTextAreaElement>(null);
	useLayoutEffect(() => {
		const input = inputRef.current;
		if (input) {
			input.style.height = "0px";
			input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
		}
	}, [text]);
	useEffect(() => {
		if (replyTarget) inputRef.current?.focus();
	}, [replyTarget]);
	const [isRoomSettingOpen, setIsRoomSettingOpen] = useState<boolean>(false);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [jumpId, setJumpId] = useState<number | null>(null);
    useEffect(() => { setLibraryOpen(false); setJumpId(null); }, [embeddedRoomId, searchParams.get('roomId')]);
	const [isHeaderProfileOpen, setIsHeaderProfileOpen] = useState(false);
	const [isSendingAttachments, setIsSendingAttachments] = useState(false);
	const uploadAttempt = useRef<{ signature: string; id: string } | null>(null);
	const sending = useRef(false);
	const {
		attachments,
		errors: attachmentErrors,
		addFiles,
		removeAttachment,
		clearAttachments,
		clearErrors: clearAttachmentErrors,
	} = useSelectedAttachments();

	const roomIdParam = embeddedRoomId !== undefined ? String(embeddedRoomId) : searchParams.get("roomId");
	const parsedRoomId = roomIdParam ? Number(roomIdParam) : null;
	const roomId =
		parsedRoomId !== null && !Number.isNaN(parsedRoomId) ? parsedRoomId : null;

	useActiveRoomCall(roomId);
	useEffect(() => () => attachmentMedia.pauseAll(), [roomId]);

	useEffect(() => {
		if (!roomId) {
			navigate("/");
			return;
		}
		dispatch(messageActions.setActiveRoom(roomId));
		dispatch(messageActions.clearMessages());
		dispatch(messageActions.setIsAtBottom(true));
		dispatch(fetchMyRooms());
		dispatch(fetchRoomMessages({ roomId: roomId }));
	}, [dispatch, roomId, navigate]);

	useEffect(() => {
		return () => {
			dispatch(messageActions.setActiveRoom(null));
		};
	}, [dispatch]);

	const currentRoom = useMemo(() => {
		if (!roomId) return null;
		return rooms?.find((room: Room) => room.id === roomId) ?? null;
	}, [rooms, roomId]);

	useEffect(() => {
		if (!roomId || roomsStatus !== "succeeded" || currentRoom) return;

		dispatch(messageActions.setActiveRoom(null));
		dispatch(messageActions.clearMessages());
		navigate("/");
	}, [currentRoom, dispatch, navigate, roomId, roomsStatus]);

	const interlocutor = useMemo(() => {
		if (!currentRoom || !myUser) return null;

		const interlocutorId = currentRoom.memberIds.find(
			(memberId) => memberId !== myUser.id,
		);

		if (!interlocutorId) return null;

		return usersById[interlocutorId] ?? null;
	}, [currentRoom, myUser, usersById]);

	const roomTitle = useMemo(() => {
		if (currentRoom?.type === "PRIVATE") {
			return interlocutor?.displayName || "Unknown";
		}

		return currentRoom?.name || "Unknown";
	}, [currentRoom, interlocutor]);

	const avatarColorKey = useMemo(() => {
		if (currentRoom?.type === "PRIVATE") {
			return interlocutor?.username || "unknown-user";
		}

		return currentRoom?.name || "unknown-room";
	}, [currentRoom, interlocutor]);

	const avatarBg = useMemo(() => {
		return StringToColor(avatarColorKey);
	}, [avatarColorKey]);

	const avatarSrc = useMemo(() => {
		if (currentRoom?.type === "PRIVATE") {
			return interlocutor?.avatarUrl || null;
		}
		return currentRoom?.avatarUrl || null;
	}, [currentRoom, interlocutor]);
	const resolvedAvatarSrc = resolveMediaUrl(avatarSrc);

	const avatarFallback = useMemo(() => {
		if (currentRoom?.type === "PRIVATE") {
			return (interlocutor?.displayName?.[0] || "?").toUpperCase();
		}

		return (currentRoom?.name?.[0] || "?").toUpperCase();
	}, [currentRoom, interlocutor]);

	const onSend = async () => {
		const trimmedText = text.trim();
		if (
			(!trimmedText && attachments.length === 0) ||
			!roomId ||
			wsStatus !== "connected" ||
			isSendingAttachments
		)
			return;

		if (attachments.length > 0) {
			if (sending.current) return;
			sending.current = true;
			const signature = JSON.stringify([roomId, trimmedText, replyTarget?.messageId, attachments.map(a => a.id)]);
			if (uploadAttempt.current?.signature !== signature) uploadAttempt.current = { signature, id: crypto.randomUUID() };
			setIsSendingAttachments(true);
			try {
				await dispatch(
					sendMessageWithAttachments({
						roomId,
						clientRequestId: uploadAttempt.current.id,
						content: trimmedText,
						files: attachments.map((attachment) => attachment.file),
						replyToMessageId: replyTarget?.messageId ?? null,
					}),
				).unwrap();

				setText("");
				clearAttachments();
				uploadAttempt.current = null;
				dispatch(messageActions.cancelReply());
			} catch (error) {
				dispatch(
					toastActions.showToast({
						id: crypto.randomUUID(),
						type: "error",
						title: "Вложения",
						message:
							typeof error === "string"
								? error
								: error instanceof Error
									? error.message
									: "Не удалось отправить файлы",
					}),
				);
			} finally {
				sending.current = false;
				setIsSendingAttachments(false);
			}
			return;
		}

		dispatch(
			messageActions.sendMessage({
				roomId: roomId,
				content: {
					content: trimmedText,
					replyToMessageId: replyTarget?.messageId ?? null,
				},
			}),
		);

		setText("");
		dispatch(messageActions.cancelReply());
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (
			shouldSubmitMessage({
				key: e.key,
				shiftKey: e.shiftKey,
				isComposing: e.nativeEvent.isComposing,
				keyCode: e.keyCode,
			})
		) {
			e.preventDefault();
			void onSend();
		}
	};

	const handleStartCall = () => {
		if (!currentRoom || callStarting.current) return;
		if (
			callStatus !== "ended" &&
			callStatus !== "idle" &&
			callStatus !== "error"
		)
			return;

		if (wsStatus !== "connected") {
			console.warn("Call start blocked: websocket is not connected", {
				wsStatus,
			});
			dispatch(
				toastActions.showToast({
					id: crypto.randomUUID(),
					type: "warning",
					title: "Соединение не готово",
					message: "Подождите подключение к серверу и попробуйте снова",
				}),
			);
			return;
		}

		callStarting.current = true;
		dispatch(
			callActions.startOutgoing({
				chatRoomId: currentRoom.id,
			}),
		);

		dispatch({
			type: "call/sendInvite",
			payload: {
				chatRoomId: currentRoom.id,
				callType: "audio",
			},
		});
	};

	const handleOpenChatSetting = () => {
		setIsRoomSettingOpen(true);
	};

	const handleOpenHeaderProfile = () => {
		if (currentRoom?.type === "PRIVATE" && interlocutor) {
			setIsHeaderProfileOpen(true);
			return;
		}

		setIsRoomSettingOpen(true);
	};

	return (
		<div className={styles["chat"]}>
			<div className={styles["header"]}>
				<button
					type="button"
					className={styles["header-left"]}
					onClick={handleOpenHeaderProfile}
					title={
						currentRoom?.type === "PRIVATE"
							? "Открыть профиль"
							: "Открыть настройки комнаты"
					}
				>
					<div className={styles["avatar"]} style={{ background: avatarBg }}>
						{resolvedAvatarSrc ? (
							<img
								src={resolvedAvatarSrc}
								alt={roomTitle}
								className={styles["avatar-image"]}
							/>
						) : (
							<div className={styles["avatar-fallback"]}>{avatarFallback}</div>
						)}
					</div>

					<span className={styles["header-copy"]}>
						<span className={styles["title"]} title={roomTitle}>
							{roomTitle}
						</span>
						<span className={styles["header-status"]}>
							{currentRoom?.type === "PRIVATE"
								? interlocutor?.status === "ONLINE"
									? "В сети"
									: "Не в сети"
								: `${currentRoom?.memberIds.length ?? 0} участников`}
						</span>
					</span>
				</button>

				<div className={styles["header-right"]}>
                    <button className={styles.btn} title="Медиа и файлы" aria-label="Медиа и файлы" aria-pressed={libraryOpen} onClick={() => setLibraryOpen(value => !value)}><Images size={20} /></button>
					<button
						className={styles["btn"]}
						title="Начать звонок"
						aria-label="Начать звонок"
						onClick={handleStartCall}
						disabled={wsStatus !== "connected" || !["idle", "ended", "error"].includes(callStatus)}
					>
						<Phone color="currentColor" size={20} />
					</button>
					<button
						className={styles["btn"]}
						title="Настройки чата"
						aria-label="Настройки чата"
						onClick={handleOpenChatSetting}
					>
						<SettingsIcon color="currentColor" size={20} />
					</button>
				</div>
			</div>

			{embeddedRoomId === undefined && <RoomActiveCallBanner roomId={roomId} />}

			{currentRoom && (
				<RoomSettingModal
					isOpen={isRoomSettingOpen}
					onClose={() => setIsRoomSettingOpen(false)}
					onStartCall={handleStartCall}
					room={currentRoom}
				/>
			)}

			<UserMiniProfileModal
				userId={interlocutor?.id ?? null}
				isOpen={isHeaderProfileOpen && Boolean(interlocutor)}
				fallbackUser={
					interlocutor
						? {
								username: interlocutor.username,
								displayName: interlocutor.displayName,
								avatarUrl: interlocutor.avatarUrl,
							}
						: undefined
				}
				onClose={() => setIsHeaderProfileOpen(false)}
			/>

            {libraryOpen && roomId && <RoomAttachments key={roomId} roomId={roomId} onClose={() => setLibraryOpen(false)} onJump={id => { setLibraryOpen(false); setJumpId(id); }} />}
			<DmItemsList roomId={roomId ?? undefined} jumpId={jumpId} onJumpHandled={() => setJumpId(null)} />

			<div className={styles["input-bar"]}>
				{replyTarget && (
					<div className={styles["reply-preview"]}>
						<div className={styles["reply-preview-content"]}>
							<span className={styles["reply-label"]}>
								Ответ для {replyTarget.authorDisplayName}
							</span>
							<span className={styles["reply-snippet"]}>
								{replyTarget.deleted
									? "Original message was deleted"
									: replyTarget.snippet || "Message unavailable"}
							</span>
						</div>
						<button
							className={styles["reply-cancel"]}
							onClick={() => dispatch(messageActions.cancelReply())}
							aria-label="Отменить ответ"
						>
							<X size={14} />
						</button>
					</div>
				)}
				<SelectedAttachmentsPreview
					disabled={isSendingAttachments}
					attachments={attachments}
					errors={attachmentErrors}
					onRemove={removeAttachment}
					onClearError={clearAttachmentErrors}
				/>
				{isSendingAttachments && <div role="status">Отправка файлов…</div>}
				<div className={styles["composer-row"]}
					onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }}
					onDrop={event => { if (event.dataTransfer.files.length) { event.preventDefault(); if (!sending.current) addFiles(event.dataTransfer.files); } }}
					onPaste={event => { const files = Array.from(event.clipboardData.files).filter(file => ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)); if (files.length && !sending.current) { event.preventDefault(); addFiles(files); } }}>
					<AttachmentPicker
						disabled={isSendingAttachments}
						onSelectFiles={addFiles}
					/>

					<textarea
						ref={inputRef}
						rows={1}
						className={styles["input"]}
						aria-label="Сообщение"
						placeholder={`Написать ${roomTitle}`}
						value={text}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={handleKeyPress}
						disabled={isSendingAttachments}
					/>
					<button
						className={styles["message-button"]}
						aria-label="Отправить сообщение"
						onClick={() => void onSend()}
						disabled={
							isSendingAttachments ||
							wsStatus !== "connected" ||
							(!text.trim() && attachments.length === 0)
						}
					>
						<Send color="currentColor" size={20} />
					</button>
				</div>
			</div>
		</div>
	);
}
