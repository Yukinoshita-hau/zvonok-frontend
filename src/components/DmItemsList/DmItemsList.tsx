import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import styles from "./DmItemsList.module.css";
import { fetchRoomMessages, messageActions } from "../../store/slices/message.slice";
import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import type { ShortMessage } from "../../entities/shortMessage";
import { formatTime, isSameDay } from "../../utils/timeHelpers";

export function DmItemsList() {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { roomId } = useParams();
	const dispatch = useDispatch<AppDispatch>()
	const { messages, status, hasMore, oldestMessageId } = useSelector((s: RootState) => s.message);
	const { myUser } = useSelector((s: RootState) => s.user);
	const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
	const [editContent, setEditContent] = useState("");

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

	const handleDelete = (messageId: number) => {
		dispatch(messageActions.deleteMessage({ messageId }));
	}

	const handleStartEdit = (messageId: number, currentContent: string) => {
		setEditingMsgId(messageId);
		setEditContent(currentContent);
	}

	const handleSaveEdit = (messageId: number) => {
		if (!editContent.trim()) return;

		dispatch(messageActions.editMessage({
			messageId,
			newContent: editContent.trim()
		}));
		setEditingMsgId(null);
	}

	const handleCancelEdit = () => {
		setEditingMsgId(null);
		setEditContent("");
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
		if (status === "succeeded" && messages.length <= 15 && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [status])

	return (
		<div className={styles["messages"]} onScroll={handleScroll} ref={scrollRef}>

			{chatItems.map(item => {
				if (item.type === "divider") {
					return (
						<div className={styles["data-divider"]} key={item.key}>
							<span className={styles["data-label"]}>{item.label}</span>
						</div>
					)
				}

				const isMyMessage = item.payload.sender.username === myUser?.username;
				const isEditing = editingMsgId === item.payload.id;
				const isEdited = item.payload.eventType === "MESSAGE_EDIT";

				return (
					<div key={item.key} className={styles["message-row"]}>
						<div className={styles["msg-avatar"]} />
						<div className={styles["msg-body"]}>
							<div className={styles["msg-meta"]}>
								<span className={styles["msg-author"]}>{item.payload.sender.username}</span>
								<span className={styles["msg-time"]}>{formatTime(item.payload.sentAt)}</span>
							</div>
							{isEditing ? (
								<div className={styles["msg-edit-container"]}>
									<input
										value={editContent}
										onChange={(e) => setEditContent(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") handleSaveEdit(item.payload.id);
											if (e.key === "Escape") handleCancelEdit();
										}}
										autoFocus
									/>
									<button onClick={() => handleSaveEdit(item.payload.id)}>Save</button>
									<button onClick={() => handleCancelEdit()}>Cancel</button>
								</div>
							) : (

								<div className={styles["msg-text"]}>
									{item.payload.content}
									{isEdited && <span> Edited </span>}
								</div>
							)}

							{isMyMessage && !isEditing && (
								<div className={styles["msg-actions"]}>
									<button onClick={() => handleStartEdit(item.payload.id, item.payload.content)}>Edit</button>
									<button onClick={() => handleDelete(item.payload.id)}>Delete</button>
								</div>
							)}
						</div>
					</div>
				)
			})}
		</div>
	)
}
