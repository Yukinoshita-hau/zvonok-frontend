import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./DmChat.module.css";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { useEffect, useMemo, useState } from "react";
import { fetchRoomMessages, messageActions } from "../../store/slices/message.slice";
import { DmItemsList } from "../../components/DmItemsList/DmItemsList";
import { fetchMyRooms } from "../../store/slices/room.slice";
import { callActions } from "../../store/slices/call.slice";
import type { Room } from "../../entities/room";
import { Phone, Send, SettingsIcon } from "lucide-react";
import { RoomSettingModal } from "../../components/RoomSettingModal/RoomSettingModal";
import { StringToColor } from "../../utils/stringHelpers";

export function DmChat() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const dispatch = useDispatch<AppDispatch>();

	const { rooms } = useSelector((s: RootState) => s.room);
	const { myUser } = useSelector((s: RootState) => s.user);

	const [text, setText] = useState("");
	const [isRoomSettingOpen, setIsRoomSettingOpen] = useState<boolean>(false);

	const roomIdParam = searchParams.get("roomId");
	const parsedRoomId = roomIdParam ? Number(roomIdParam) : null;
	const roomId = parsedRoomId !== null && !Number.isNaN(parsedRoomId) ? parsedRoomId: null;

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

		return (
			currentRoom.members?.find(
				(member) => member.username !== myUser.username
			) ?? null
		);
	}, [currentRoom, myUser]);

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

	const onSend = () => {
		if (!text.trim() || !roomId) return;

		dispatch(
			messageActions.sendMessage({
				roomId: roomId,
				content: text.trim(),
			})
		);

		setText("");
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") onSend();
	};

	const handleStartCall = () => {
		if (!currentRoom) return;

		const prefix = currentRoom.type === "GROUP" ? "group-" : "dm-";
		const livekitRoomName = `${prefix}${currentRoom.id}`;

		const peerUsernames: string[] = currentRoom.members
			.map((member) => member.username)
			.filter((username) => username !== myUser?.username);

		dispatch(
			callActions.startOutgoing({
				chatRoomId: currentRoom.id,
				livekitRoomName,
				peerUsernames,
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
					<button className={styles["btn"]} onClick={handleStartCall}>
						<Phone color="white" size={20} />
					</button>
					<button className={styles["btn"]} onClick={handleOpenChatSetting}>
						<SettingsIcon color="white" size={20} />
					</button>
				</div>
			</div>

			<RoomSettingModal
				isOpen={isRoomSettingOpen}
				onClose={() => setIsRoomSettingOpen(false)}
				onStartCall={handleStartCall}
				room={currentRoom}
			/>

			<DmItemsList />

			<div className={styles["input-bar"]}>
				<input
					className={styles["input"]}
					placeholder="Message @here"
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={handleKeyPress}
				/>
				<button className={styles["message-button"]} onClick={onSend}>
					<Send color="white" size={20} />
				</button>
			</div>
		</div>
	);
}
