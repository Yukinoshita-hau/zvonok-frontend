import cn from "classnames";
import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import styles from "./DmItemsList.module.css";
import { fetchRoomMessages, getMessagesReaders, messageActions } from "../../store/slices/message.slice";
import { useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import type { ShortMessage } from "../../entities/shortMessage";
import { formatTime, isSameDay } from "../../utils/timeHelpers";
import { MessagesSkeleton } from "../MessagesSkeleton/MessagesSkeleton";
import { markRoomAsRead } from "../../store/slices/room.slice";

type ContextMenuState = {
	x: number;
	y: number;
	messageId: number;
} | null;

export function DmItemsList() {
	const [searchParams] = useSearchParams();
	const dispatch = useDispatch<AppDispatch>()
	const { messages, status, hasMore, oldestMessageId, isAtBottom, newDividerMessageId } = useSelector((s: RootState) => s.message);
	const { rooms } = useSelector((s: RootState) => s.room);
	const { myUser } = useSelector((s: RootState) => s.user);
	const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
	const [editContent, setEditContent] = useState("");
	const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

	const scrollRef = useRef<HTMLDivElement>(null);
	const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
	const roomId = searchParams.get("roomId")
	const numericRoomId = Number(roomId);
	const currentRoom = rooms?.find(r => r.id === Number(roomId));


	const readMessageIds = useMemo(() =>
		new Set(messages.filter(msg =>
			msg.readBy?.includes(myUser?.username || ""))
			.map(msg => msg.id)),
		[messages, myUser?.username]
	)

	useEffect(() => {
		dispatch(messageActions.setIsAtBottom(true))
	}, [roomId])

	useEffect(() => {
		if (status === "succeeded" && scrollRef.current &&
			isAtBottom) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [status, messages, isAtBottom, roomId])

	useEffect(() => {
		if (currentRoom && currentRoom.unreadCount > 0 && newDividerMessageId === null && currentRoom.firstUnreadMessageId != null) {
			dispatch(messageActions.setNewDividerMessageId(currentRoom.firstUnreadMessageId))
		}
	}, [currentRoom?.unreadCount, currentRoom?.id, currentRoom?.firstUnreadMessageId, newDividerMessageId, dispatch])

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

	const lastVisibleMessageId = useMemo(() => {
		if (messages.length === 0) return null;
		return messages[messages.length - 1].id;
	}, [messages])

	useEffect(() => {
		if (!isAtBottom || lastVisibleMessageId === null) return;

		dispatch(messageActions.markMessageRead({
			messageId: lastVisibleMessageId,
		}))
	}, [dispatch, isAtBottom, lastVisibleMessageId, myUser?.username])

	useEffect(() => {
		if (isAtBottom && currentRoom?.unreadCount > 0) {
			dispatch(markRoomAsRead({ roomId: numericRoomId }));
		}
	}, [dispatch, isAtBottom, currentRoom?.unreadCount, numericRoomId])

	useEffect(() => {
		if (status !== "succeeded" || !messages.length || !myUser?.username) return;

		const newMessageIds = messages
			.slice(-15)
			.filter(msg => msg.sender.username === myUser.username)
			.map(msg => msg.id);


		if (newMessageIds.length > 0) {
			dispatch(getMessagesReaders({ messageIds: newMessageIds }));
		}
	}, [status]);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						const messageId = Number(entry.target.getAttribute('data-id'));
						const stateMessage = messages.find(m => m.id === messageId);
						if (stateMessage?.readBy?.includes(myUser?.username ?? "") === undefined) {
							setTimeout(() => {
								dispatch(messageActions.markMessageRead({ messageId }));
							}, 1000);
						}
					}
				});
			},
			{ threshold: 0.5, rootMargin: '10px' }
		);

		const unsubscribe = () => {
			messageRefs.current.forEach(el => observer.unobserve(el));
		};

		const interval = setInterval(() => {
			messageRefs.current.forEach(el => {
				if (!observer.observedElements?.has(el)) {
					observer.observe(el);
				}
			});
		}, 500);

		return () => {
			clearInterval(interval);
			unsubscribe();
			observer.disconnect();
		};
	}, []);  // ✅ ПУСТЫЕ зависимости!

	const handleScroll = async (e: UIEvent<HTMLDivElement>) => {
		const container = e.currentTarget;
		const atBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 60;

		//isAtBottom.current = atBottom;
		if (isAtBottom !== atBottom) {
			dispatch(messageActions.setIsAtBottom(atBottom));
		}

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

			if (newDividerMessageId && messages[i].id === newDividerMessageId) {
				itemArr.push({ type: "divider", label: "New", rawDate: "New", key: `date-divider-${i}-${currentMsg.id}` });
			}

			itemArr.push({ type: "msg", payload: currentMsg, key: `${currentMsg.id}` });
		}

		return itemArr;
	}, [messages, currentRoom])

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
				const isEdited = item.payload.eventType === "MESSAGE_EDIT" || item.payload.editedAt !== null;

				return (
					<div key={item.key}
						ref={(el) => {
							if (el) messageRefs.current.set(item.payload.id, el);
							else messageRefs.current.delete(item.payload.id);
						}}
						data-id={item.payload.id}
						data-sender={item.payload.sender.username}
						className={styles["message-row"]}
						onContextMenu={(e) => {
							isMyMessage && openContextMenu(e, item.payload)
						}}>
						<div className={styles["msg-avatar"]} >
							<img src="http://localhost:8080/api/s3/download/aga1.png" crossOrigin="anonymous" />
						</div>
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
									{isMyMessage && (
										<div>
											{item.payload.readBy?.length ?
												`✓✓ ` :
												"✓"
											}
										</div>
									)}
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
						Edit
					</button>

					<div className={styles["menu-divider"]} />

					<button
						className={styles["danger"]}
						onClick={() => {
							handleDelete(contextMenu.messageId);
							setContextMenu(null);
						}}
					>
						Delete
					</button>
				</div>
			)}
		</div>
	)
}
