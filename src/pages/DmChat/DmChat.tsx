import { useNavigate, useParams } from "react-router-dom";
import styles from "./DmChat.module.css";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { useEffect, useMemo, useState } from "react";
import { fetchRoomMessages, messageActions } from "../../store/slices/message.slice";
import { DmItemsList } from "../../components/DmItemsList/DmItemsList";
import { fetchMyRooms } from "../../store/slices/room.slice";
import { callActions } from "../../store/slices/call.clice";
import type { Room } from "../../entities/room";
import { ActiveCallOverlay } from "../../components/ActiveCallOverlay/ActiveCallOverlay";

export function DmChat() {
	const { roomId, username } = useParams();
	const [text, setText] = useState("");
	const dispatch = useDispatch<AppDispatch>();
	const { rooms } = useSelector((s: RootState) => s.room);
	const { myUser } = useSelector((s: RootState) => s.user);
	const activeRoomId = useSelector((s: RootState) => s.message.activeRoomId);
	const pending = useSelector((s: RootState) => s.message.pendingPrivateUsername)
	const navigate = useNavigate();

	useEffect(() => {
		if (roomId) {
			dispatch(messageActions.setActiveRoom(Number(roomId)));
			dispatch(messageActions.setPendingPrivate(null));
			dispatch(messageActions.clearMessages());
			dispatch(fetchMyRooms())
			dispatch(fetchRoomMessages({ roomId: Number(roomId) }))
		} else if (username) {
			dispatch(messageActions.setPendingPrivate(username));
			dispatch(messageActions.setActiveRoom(null))
			dispatch(fetchMyRooms())
			dispatch(messageActions.clearMessages());
		}

		return () => {
			dispatch(messageActions.setActiveRoom(null))
			dispatch(messageActions.setPendingPrivate(null))
		}
	}, [dispatch, roomId])

	useEffect(() => {
		if (activeRoomId && pending === null && !roomId) {
			navigate(`/${activeRoomId}`)
		}
	}, [activeRoomId, pending])

	const currentRoom = useMemo(() => {
		return rooms?.find((room: Room) => room.id === Number(roomId)) as Room;
	}, [rooms, roomId])

	const roomName = useMemo(() => {
		if (!currentRoom) return "Unknown";

		if (currentRoom.name) return currentRoom.name;


		const opponent = currentRoom.members.find(member => member.username !== myUser?.username);

		return opponent?.username || "Unknown"
	}, [currentRoom])


	const onSend = () => {
		if (!text.trim()) return;

		if (roomId) {

			dispatch(messageActions.sendMessage({
				roomId: roomId,
				content: text.trim()
			}))
		} else if (username) {

			dispatch(messageActions.sendPrivateMessage({
				receiver: username,
				content: text.trim()
			}))
		}

		setText("");
	}

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") onSend();
	}

	const handleStartCall = () => {
		if (!currentRoom) return;

		const prefix = currentRoom.type === "GROUP" ? "group-" : "dm-";
		const livekitRoomName = `${prefix}${currentRoom.id}`

		const peerUsernames: string[] = currentRoom.members
			.map(member => member.username)
			.filter(username => username !== myUser?.username)

		dispatch(callActions.startOutgoing({
			chatRoomId: currentRoom.id,
			livekitRoomName: livekitRoomName,
			peerUsernames: peerUsernames
		}));

		dispatch({
			type: "call/sendInvite",
			payload: {
				chatRoomId: currentRoom.id,
				callType: "audio"
			}
		})
	}


	return (
		<div className={styles["chat"]}>
			<div className={styles["header"]}>
				<div className={styles["header-left"]}>
					<div className={styles["avatar"]} />
					<span className={styles["title"]}>
						{roomName}
					</span>
				</div>
				<div className={styles["header-right"]}>
					<button className={styles["call-button"]} onClick={handleStartCall}>
						<img src="../../../public/call_icon.svg" alt="иконка телефона" />
					</button>
					{/* Надо будет закинуться иконуи звонка / файла / поиска */}
				</div>
			</div>

			{currentRoom !== undefined && <ActiveCallOverlay currentRoomId={currentRoom.id} />}

			<DmItemsList />
			<div className={styles["input-bar"]}>
				<input
					className={styles["input"]}
					placeholder="Message @here"
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={handleKeyPress}
				/>
				<button className={styles["messageButton"]} onClick={onSend}>
					<img src="../../../public/send-message-icon.png" />
				</button>
			</div>
		</div>

	)
}

