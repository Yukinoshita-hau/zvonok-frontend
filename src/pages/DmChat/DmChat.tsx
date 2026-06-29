import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./DmChat.module.css";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { useEffect, useMemo, useState } from "react";
import { fetchRoomMessages, messageActions, sendMessageWithAttachments } from "../../store/slices/message.slice";
import { DmItemsList } from "../../components/DmItemsList/DmItemsList";
import { fetchMyRooms } from "../../store/slices/room.slice";
import { callActions } from "../../store/slices/call.slice";
import type { Room } from "../../entities/room";
import { Phone, Send, SettingsIcon, X } from "lucide-react";
import { RoomSettingModal } from "../../components/RoomSettingModal/RoomSettingModal";
import { StringToColor } from "../../utils/stringHelpers";
import { toastActions } from "../../store/slices/toast.slice";
import { useActiveRoomCall } from "../../hooks/useActiveRoomCall";
import { RoomActiveCallBanner } from "../../components/RoomActiveCallBanner/RoomActiveCallBanner";
import { AttachmentPicker } from "../../components/MessageAttachments/AttachmentPicker";
import { MessageRecorderControls } from "../../components/MessageAttachments/MessageRecorderControls";
import { SelectedAttachmentsPreview } from "../../components/MessageAttachments/SelectedAttachmentsPreview";
import { useSelectedAttachments } from "../../hooks/useSelectedAttachments";
import type { AttachmentType } from "../../api/interfaces/MessageAttachmentDtos";

export function DmChat() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const dispatch = useDispatch<AppDispatch>();

	const { rooms } = useSelector((s: RootState) => s.room);
	const { myUser } = useSelector((s: RootState) => s.user);
	const usersById = useSelector((s: RootState) => s.users.byId);
	const { replyTarget } = useSelector((s: RootState) => s.message);
	const wsStatus = useSelector((s: RootState) => s.websocket.status);
	const callStatus = useSelector((s: RootState) => s.call.status);

	const [text, setText] = useState("");
	const [isRoomSettingOpen, setIsRoomSettingOpen] = useState<boolean>(false);
	const [isSendingAttachments, setIsSendingAttachments] = useState(false);
	const {
		attachments,
		errors: attachmentErrors,
		addFiles,
		removeAttachment,
		clearAttachments,
		clearErrors: clearAttachmentErrors,
	} = useSelectedAttachments();

	const roomIdParam = searchParams.get("roomId");
	const parsedRoomId = roomIdParam ? Number(roomIdParam) : null;
	const roomId = parsedRoomId !== null && !Number.isNaN(parsedRoomId) ? parsedRoomId : null;

	useActiveRoomCall(roomId);

	useEffect(() => {
		if (!roomId) {
			navigate("/")
			return

		}
		dispatch(messageActions.setActiveRoom(roomId));
		dispatch(messageActions.clearMessages());
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

	const interlocutor = useMemo(() => {
		if (!currentRoom || !myUser) return null;

		const interlocutorId = currentRoom.memberIds.find(
			(memberId) => memberId !== myUser.id
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

	const avatarFallback = useMemo(() => {
		if (currentRoom?.type === "PRIVATE") {
			return (interlocutor?.displayName?.[0] || "?").toUpperCase();
		}

		return (currentRoom?.name?.[0] || "?").toUpperCase();
	}, [currentRoom, interlocutor]);

	const onSend = async () => {
		const trimmedText = text.trim();
		if ((!trimmedText && attachments.length === 0) || !roomId || isSendingAttachments) return;

		if (attachments.length > 0) {
			setIsSendingAttachments(true);
			try {
				await dispatch(sendMessageWithAttachments({
					roomId,
					content: trimmedText,
					files: attachments.map((attachment) => attachment.file),
					replyToMessageId: replyTarget?.messageId ?? null,
				})).unwrap();

				setText("");
				clearAttachments();
				dispatch(messageActions.cancelReply());
			} catch (error) {
				dispatch(toastActions.showToast({
					id: crypto.randomUUID(),
					type: "error",
					title: "Вложения",
					message: typeof error === "string"
						? error
						: error instanceof Error ? error.message : "Не удалось отправить файлы"
				}));
			} finally {
				setIsSendingAttachments(false);
			}
			return;
		}

		dispatch(
			messageActions.sendMessage({
				roomId: roomId,
				content: {
					content: trimmedText,
					replyToMessageId: replyTarget?.messageId ?? null
				}
			})
		);

		setText("");
		dispatch(messageActions.cancelReply());
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			void onSend();
		}
	};

	const handleSendRecorded = async (payload: {
		file: File;
		attachmentType: Extract<AttachmentType, "AUDIO" | "VIDEO_NOTE">;
		durationMs: number;
	}) => {
		if (!roomId || isSendingAttachments) return;

		setIsSendingAttachments(true);
		try {
			await dispatch(sendMessageWithAttachments({
				roomId,
				content: text.trim(),
				files: [payload.file],
				replyToMessageId: replyTarget?.messageId ?? null,
				attachmentType: payload.attachmentType,
				durationMs: payload.durationMs,
			})).unwrap();

			setText("");
			dispatch(messageActions.cancelReply());
		} catch (error) {
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "error",
				title: payload.attachmentType === "AUDIO" ? "Голосовое" : "Видео-кружок",
				message: typeof error === "string"
					? error
					: error instanceof Error ? error.message : "Не удалось отправить запись"
			}));
			throw error;
		} finally {
			setIsSendingAttachments(false);
		}
	};

	const handleStartCall = () => {
		if (!currentRoom) return;
		if (callStatus !== "ended" && callStatus !== "idle" && callStatus !== "error") return;

		if (wsStatus !== "connected") {
			console.warn("Call start blocked: websocket is not connected", { wsStatus });
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "warning",
				title: "Соединение не готово",
				message: "Подождите подключение к серверу и попробуйте снова"
			}));
			return;
		}

		dispatch(
			callActions.startOutgoing({
				chatRoomId: currentRoom.id,
			})
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

	return (
		<div className={styles["chat"]}>
			<div className={styles["header"]}>
				<div className={styles["header-left"]}>
					<div className={styles["avatar"]} style={{ background: avatarBg }}>
						{avatarSrc ? (
							<img
								src={avatarSrc}
								alt={roomTitle}
								crossOrigin="anonymous"
								className={styles["avatar-image"]}
							/>
						) : (
							<div className={styles["avatar-fallback"]}>{avatarFallback}</div>
						)}
					</div>

					<span className={styles["title"]}>{roomTitle}</span>
				</div>

				<div className={styles["header-right"]}>
					<button className={styles["btn"]} onClick={handleStartCall} disabled={wsStatus !== "connected"}>
						<Phone color="white" size={20} />
					</button>
					<button className={styles["btn"]} onClick={handleOpenChatSetting}>
						<SettingsIcon color="white" size={20} />
					</button>
				</div>
			</div>

			<RoomActiveCallBanner roomId={roomId} />

			<RoomSettingModal
				isOpen={isRoomSettingOpen}
				onClose={() => setIsRoomSettingOpen(false)}
				onStartCall={handleStartCall}
				room={currentRoom}
			/>

			<DmItemsList />

			<div className={styles["input-bar"]}>
				{replyTarget && (
					<div className={styles["reply-preview"]}>
						<div className={styles["reply-preview-content"]}>
							<span className={styles["reply-label"]}>
								Replying to {replyTarget.authorDisplayName}
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
							aria-label="Cancel reply"
						>
							<X size={14} />
						</button>
					</div>
				)}
				<SelectedAttachmentsPreview
					attachments={attachments}
					errors={attachmentErrors}
					onRemove={removeAttachment}
					onClearError={clearAttachmentErrors}
				/>
				<div className={styles["composer-row"]}>
					<AttachmentPicker
						disabled={isSendingAttachments}
						onSelectFiles={addFiles}
					/>
					<MessageRecorderControls
						disabled={isSendingAttachments || attachments.length > 0}
						onSendRecorded={handleSendRecorded}
					/>
					<input
						className={styles["input"]}
						placeholder="Message @here"
						value={text}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={handleKeyPress}
						disabled={isSendingAttachments}
					/>
					<button
						className={styles["message-button"]}
						onClick={() => void onSend()}
						disabled={isSendingAttachments || (!text.trim() && attachments.length === 0)}
					>
						<Send color="white" size={20} />
					</button>
				</div>
			</div>
		</div>
	);
}
