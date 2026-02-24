import { useNavigate, useParams } from "react-router-dom";
import styles from "./DmChat.module.css";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { useEffect, useMemo, useState } from "react";
import { fetchRoomMessages, messageActions } from "../../store/slices/message.slice";
import { websocketActions } from "../../store/slices/websocket.slice";
import { DmItemsList } from "../../components/DmItemsList/DmItemsList";
import { fetchMyRooms } from "../../store/slices/room.slice";

export function DmChat() {
	const { roomId, username } = useParams();
	const [text, setText] = useState("");
	const dispatch = useDispatch<AppDispatch>();
	const { rooms } = useSelector((s: RootState) => s.room);
	const { myUser } = useSelector((s: RootState) => s.user);
	const wsStatus = useSelector((s: RootState) => s.websocket.status);
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
		if (wsStatus === "idle") {
			dispatch(websocketActions.connectStart());
		}
	}, [dispatch, wsStatus])

	useEffect(() => {
		if (activeRoomId && pending === null && !roomId) {
			navigate(`/${activeRoomId}`)
		}
	}, [activeRoomId, pending])

	const currentRoom = useMemo(() => {
		return rooms?.find(room => room.id === Number(roomId))
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
					{/* Надо будет закинуться иконуи звонка / файла / поиска */}
				</div>
			</div>

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

