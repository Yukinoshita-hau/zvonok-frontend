import cn from "classnames";
import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import styles from "./DmItemsList.module.css";
import { fetchRoomMessages, messageActions } from "../../store/slices/message.slice";
import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import type { ShortMessage } from "../../entities/shortMessage";
import { formatTime, isSameDay } from "../../utils/timeHelpers";
import { MessagesSkeleton } from "../MessagesSkeleton/MessagesSkeleton";

type ContextMenuState = {
	x: number;
	y: number;
	messageId: number;
} | null;

export function DmItemsList() {
	const { roomId } = useParams();
	const scrollRef = useRef<HTMLDivElement>(null);
	const isAtBottom = useRef<boolean>(true);
	const dispatch = useDispatch<AppDispatch>()
	const { messages, status, hasMore, oldestMessageId } = useSelector((s: RootState) => s.message);
	const { myUser } = useSelector((s: RootState) => s.user);
	const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
	const [editContent, setEditContent] = useState("");
	const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

	useEffect(() => {
		isAtBottom.current = true;
	}, [roomId])

	useEffect(() => {
		if (status === "succeeded" && scrollRef.current &&
			isAtBottom.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [status, messages])

	useEffect(() => {
		const close = () => setContextMenu(null);
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		}
		window.addEventListener("click", close);
		window.addEventListener("scroll", close);
		window.addEventListener("keydown", onKey);

		return () => {
			window.removeEventListener("click", close);
			window.removeEventListener("scroll", close);
			window.removeEventListener("keydown", onKey);
		}
	}, [])

	const handleScroll = async (e: UIEvent<HTMLDivElement>) => {
		const container = e.currentTarget;
		isAtBottom.current = (container.scrollHeight - container.scrollTop - container.clientHeight) < 60;

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

	const openContextMenu = (e: React.MouseEvent, msg: ShortMessage) => {
		e.preventDefault();

		const menuWidth = 160;
		const menuHeight = 96;

		let x = e.clientX;
		let y = e.clientY;

		if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
		if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

		setContextMenu({
			x,
			y,
			messageId: msg.id
		});
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

	return (
		<div className={styles["messages"]} onScroll={handleScroll} ref={scrollRef}>
			{status === "loading" && <MessagesSkeleton />}
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
					<div key={item.key}
						className={styles["message-row"]}
						onContextMenu={(e) => {
							isMyMessage && openContextMenu(e, item.payload)
						}}>
						<div className={styles["msg-avatar"]} />
						<div className={styles["msg-body"]}>
							<div className={styles["msg-meta"]}>
								<span className={styles["msg-author"]}>{item.payload.sender.username}</span>
								<span className={styles["msg-time"]}>{formatTime(item.payload.sentAt)}</span>
								{isEdited && (
									<span className={styles["edited-badge"]}>edited</span>
								)}
							</div>
							{isEditing ? (
								<div className={styles["edit-box"]}>
									<input
										className={styles["edit-input"]}
										value={editContent}
										onChange={(e) => setEditContent(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") handleSaveEdit(item.payload.id);
											if (e.key === "Escape") handleCancelEdit();
										}}
										autoFocus
									/>
									<div className={styles["edit-actions"]}>
										<button className={styles["btn-primary"]} onClick={() => handleSaveEdit(item.payload.id)}>Save</button>
										<button className={styles["btn-secondary"]} onClick={() => handleCancelEdit()}>Cancel</button>
									</div>
								</div>
							) : (

								<div className={styles["msg-text"]}>
									{item.payload.content}
								</div>
							)}

						</div>
					</div>
				)
			})}

			{contextMenu && (
				<div
					className={cn(styles["context-menu"], styles["menu-animate"])}
					style={{ top: contextMenu.y, left: contextMenu.x }}
					onClick={(e) => e.stopPropagation()}
				>
					<button
						onClick={() => {
							const msg = messages.find(m => m.id === contextMenu.messageId);
							if (msg) handleStartEdit(msg.id, msg.content);
							setContextMenu(null);
						}}>
						✏ Edit
					</button>

					<div className={styles["menu-divider"]} />

					<button
						className={styles["danger"]}
						onClick={() => {
							handleDelete(contextMenu.messageId);
							setContextMenu(null);
						}}
					>
						🗑 Delete
					</button>
				</div>
			)}
		</div>
	)
}
