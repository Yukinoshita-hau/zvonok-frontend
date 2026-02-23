import { useParams } from "react-router-dom";
import styles from "./DmChat.module.css";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { fetchRoomMessages, messageActions } from "../../store/slices/message.slice";
import { formatTime, isSameDay } from "../../utils/timeHelpers";
import type { ShortMessage } from "../../entities/shortMessage";
import { websocketActions } from "../../store/slices/websocket.slice";

export function DmChat() {
	const { roomId } = useParams();
	const [text, setText] = useState("");
	const dispatch = useDispatch<AppDispatch>()
	const { rooms } = useSelector((s: RootState) => s.room)
	const { myUser } = useSelector((s: RootState) => s.user);
	const wsStatus = useSelector((s: RootState) => s.websocket.status)
	const scrollRef = useRef<HTMLDivElement>(null);

	const { messages, status, hasMore, oldestMessageId } = useSelector((s: RootState) => s.message);

	const currentRoom = useMemo(() => {
		return rooms?.find(room => room.id === Number(roomId))
	}, [rooms, roomId])

	const roomName = useMemo(() => {
		if (!currentRoom) return "Unknown";

		if (currentRoom.name) return currentRoom.name;


		const opponent = currentRoom.members.find(member => member.username !== myUser?.username);

		return opponent?.username || "Unknown"
	}, [currentRoom])


	useEffect(() => {
		if (roomId) {
			const rId = Number(roomId);
			dispatch(messageActions.clearMessages());
			dispatch(fetchRoomMessages({ roomId: rId }))
		}
	}, [dispatch, roomId])

	useEffect(() => {
		if (status === "succeeded" && messages.length <= 15 && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [status])

	const handleScroll = async (e: UIEvent<HTMLDivElement>) => {
		const container = e.currentTarget;

		if (container.scrollTop === 0 && hasMore && status !== "loading") {
			const scrollHeightBefore = container.scrollHeight;

			await dispatch(fetchRoomMessages({
				roomId: Number(roomId),
				beforeMessageId: oldestMessageId || undefined
			}));

			if (scrollRef.current) {
				const scrollHeightAfter = scrollRef.current.scrollHeight;
				const heighDifference = scrollHeightAfter - scrollHeightBefore;
				scrollRef.current.scrollTop = heighDifference;
			}
		}
	}

	const chatItems = useMemo(() => {
		const itemArr: (
			{ type: "divider"; label: string; rawDate: string; key: string } |
			{ type: "msg"; payload: ShortMessage; key: string })[] = [];

		for (let i = 0; i < messages.length; i++) {
			const currentMsg = messages[i];
			const previousMsg = i === 0 ? null : messages[i - 1];

			if ((previousMsg !== null && !isSameDay(currentMsg.sentAt, previousMsg.sentAt)) || i === 0) {
				const now = new Date();
				const yesterday = new Date();
				yesterday.setDate(now.getDate() - 1);

				if (isSameDay(now, currentMsg.sentAt)) {
					itemArr.push({ type: "divider", label: "Today", rawDate: currentMsg.sentAt, key: `divider-${currentMsg.id}` });
				} else if (isSameDay(yesterday, currentMsg.sentAt)) {
					itemArr.push({ type: "divider", label: "Yesterday", rawDate: currentMsg.sentAt, key: `divider-${currentMsg.id}` });
				} else {
					itemArr.push({ type: "divider", label: new Date(currentMsg.sentAt).toLocaleDateString(), rawDate: currentMsg.sentAt, key: `divider-${currentMsg.id}` });
				}
			}
			itemArr.push({ type: "msg", payload: currentMsg, key: `${currentMsg.id}` });
		}

		return itemArr;
	}, [messages])

	useEffect(() => {
		if (wsStatus === "idle") {
			dispatch(websocketActions.connectStart());
		}
	}, [])

	const onSend = () => {
		if (!text.trim() || !roomId) return;

		dispatch(messageActions.sendMessage({
			roomId: roomId,
			content: text.trim()
		}))

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

			<div className={styles["messages"]} onScroll={handleScroll} ref={scrollRef}>

				{chatItems.map(item => {
					if (item.type === "divider") {
						return (
							<div className={styles["data-divider"]} key={item.key}>
								<span className={styles["data-label"]}>{item.label}</span>
							</div>
						)
					}

					return (
						<div key={item.key} className={styles["message-row"]}>
							<div className={styles["msg-avatar"]} />
							<div className={styles["msg-body"]}>
								<div className={styles["msg-meta"]}>
									<span className={styles["msg-author"]}>{item.payload.sender.username}</span>
									<span className={styles["msg-time"]}>{formatTime(item.payload.sentAt)}</span>
								</div>
								<div className={styles["msg-text"]}>{item.payload.content}</div>
							</div>
						</div>
					)
				})}
			</div>

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

