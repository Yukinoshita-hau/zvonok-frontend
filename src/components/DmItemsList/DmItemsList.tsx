import cn from "classnames";
import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import styles from "./DmItemsList.module.css";
import { fetchRoomMessages, getMessagesReaders, messageActions } from "../../store/slices/message.slice";
import { useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import type { ShortMessage } from "../../entities/shortMessage";
import { formatDate, formatTime, isSameDay } from "../../utils/timeHelpers";
import { MessagesSkeleton } from "../MessagesSkeleton/MessagesSkeleton";
import { markRoomAsRead } from "../../store/slices/room.slice";
import { StringToColor } from "../../utils/stringHelpers";
import { MessageAttachments } from "../MessageAttachments/MessageAttachments";
import { resolveMediaUrl } from "../../utils/mediaUrl";

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
	const usersById = useSelector((s: RootState) => s.users.byId);
	const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
	const [editContent, setEditContent] = useState("");
	const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
	const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
	const [replyJumpNotice, setReplyJumpNotice] = useState<string | null>(null);

	const scrollRef = useRef<HTMLDivElement>(null);
	const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
	const processedIdsRef = useRef<Set<number>>(new Set());
	const roomId = searchParams.get("roomId")
	const numericRoomId = Number(roomId);
	const currentRoom = rooms?.find(r => r.id === Number(roomId));

	const lastMessageId = useMemo(() => {
		if (messages.length === 0) return null;
		return messages[messages.length - 1].id;
	}, [messages]);

	useEffect(() => {
		processedIdsRef.current.clear();
	}, [roomId]);

	useEffect(() => {
		dispatch(messageActions.setIsAtBottom(true))
	}, [roomId])

	useEffect(() => {
		if (!scrollRef.current) return;
		if (status !== "succeeded") return;
		if (!isAtBottom) return;
		if (lastMessageId === null) return;

		scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
	}, [status, lastMessageId, isAtBottom, roomId]);

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
		if (status !== "succeeded" || !messages.length || !myUser?.id) return;

		const newMessageIds = messages
			.slice(-15)
			.filter(msg => msg.senderId === myUser.id)
			.map(msg => msg.id);

		if (newMessageIds.length > 0) {
			dispatch(getMessagesReaders({ messageIds: newMessageIds }));
		}
	}, [status, myUser?.id, dispatch]);

	useEffect(() => {
		if (!myUser?.id || !myUser?.username) return;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting) return;

					const messageId = Number(entry.target.getAttribute("data-id"));
					const currentMessage = messages.find(m => m.id === messageId);

					if (!currentMessage) return;

					// свои сообщения не помечаем
					if (currentMessage.senderId === myUser.id) return;

					if (processedIdsRef.current.has(messageId)) return;

					if (currentMessage.readBy?.includes(myUser.username)) return;

					processedIdsRef.current.add(messageId);
					dispatch(messageActions.markMessageRead({ messageId }));
				});
			},
			{
				threshold: 0.5,
				root: scrollRef.current,
			}
		);

		messageRefs.current.forEach((el, id) => {
			const msg = messages.find(m => m.id === id);
			if (!el || !msg) return;

			if (msg.senderId === myUser.id) return;
			if (msg.readBy?.includes(myUser.username)) return;
			if (processedIdsRef.current.has(id)) return;

			observer.observe(el);
		});

		return () => observer.disconnect();
	}, [messages, myUser?.id, myUser?.username, dispatch]);

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

	const getReplySnippet = (msg: ShortMessage) => {
		if (msg.replyPreview?.deleted) return "Original message was deleted";
		const fallback = msg.attachments.length > 0 ? "Вложение" : "";
		const source = msg.replyPreview?.snippet || msg.content || fallback;
		return source.replace(/\s+/g, " ").trim().slice(0, 120);
	}

	const handleStartReply = (msg: ShortMessage) => {
		if (msg.eventType === "MESSAGE_DELETE") return;

		const sender = usersById[msg.senderId];

		dispatch(
			messageActions.startReply({
				messageId: msg.id,
				authorDisplayName: sender?.displayName ?? "Unknown user",
				snippet: getReplySnippet(msg),
				deleted: msg.replyPreview?.deleted ?? false
			})
		);
	};

	const handleReplyJump = (msg: ShortMessage) => {
		if (!msg.replyToMessageId) return;

		const targetEl = messageRefs.current.get(msg.replyToMessageId);
		if (!targetEl) {
			setReplyJumpNotice("Original message is not loaded in the current list");
			window.setTimeout(() => setReplyJumpNotice(null), 2200);
			return;
		}

		targetEl.scrollIntoView({
			behavior: "smooth",
			block: "center"
		});
		setHighlightedMessageId(msg.replyToMessageId);
		window.setTimeout(() => {
			setHighlightedMessageId(current => (current === msg.replyToMessageId ? null : current));
		}, 1600);
	}

	const openContextMenu = (e: React.MouseEvent, msg: ShortMessage) => {
		e.preventDefault();

		const menuWidth = 160;
		const menuHeight = msg.senderId === myUser?.id ? 132 : 48;

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
					itemArr.push({ type: "divider", label: formatDate(currentMsg.sentAt), rawDate: currentMsg.sentAt, key: `divider-${currentMsg.id}` });
				}
			}

			if (newDividerMessageId && messages[i].id === newDividerMessageId) {
				itemArr.push({ type: "divider", label: "New", rawDate: "New", key: `date-divider-${i}-${currentMsg.id}` });
			}

			itemArr.push({ type: "msg", payload: currentMsg, key: `${currentMsg.id}` });
		}

		return itemArr;
	}, [messages, newDividerMessageId])

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

				const sender = usersById[item.payload.senderId];

				if (!sender) {
					console.warn("Sender not found for message:", item.payload);
					return null;
				}

				const isMyMessage = item.payload.senderId === myUser?.id;
				const isEditing = editingMsgId === item.payload.id;
				const isEdited = item.payload.eventType === "MESSAGE_EDIT" || item.payload.editedAt !== null;

				return (
					<div key={item.key}
						ref={(el) => {
							if (el) messageRefs.current.set(item.payload.id, el);
							else messageRefs.current.delete(item.payload.id);
						}}
						data-id={item.payload.id}
						data-sender={sender.username}
						className={cn(
							styles["message-row"],
							highlightedMessageId === item.payload.id && styles["message-row-highlighted"]
						)}
						onContextMenu={(e) => {
							openContextMenu(e, item.payload)
						}}>
						<div
							className={styles["msg-avatar"]}
							style={{ background: StringToColor(sender.username) }}
						>
							{sender.avatarUrl ? (
								<img src={resolveMediaUrl(sender.avatarUrl)} />
							) : (
								<div>{(sender.displayName?.[0] || "?").toUpperCase()}</div>
							)}
						</div>
						<div className={styles["msg-body"]}>
							<div className={styles["msg-meta"]}>
								<span className={styles["msg-author"]}>{sender.displayName}</span>
								{isMyMessage && (
									<div className={styles["read-status"]}>
										{item.payload.readBy?.length ?
											`✓✓` :
											"✓"
										}
									</div>
								)}
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
								<>
									{item.payload.replyToMessageId !== null && (
										<button
											className={styles["reply-block"]}
											onClick={() => handleReplyJump(item.payload)}
											type="button"
										>
											<span className={styles["reply-author"]}>
												{item.payload.replyPreview?.authorDisplayName || "Unknown user"}
											</span>
											<span className={styles["reply-content"]}>
												{item.payload.replyPreview?.deleted
													? "Original message was deleted"
													: item.payload.replyPreview?.snippet || "Original message unavailable"}
											</span>
										</button>
									)}

									{item.payload.content && (
										<div className={styles["msg-text"]}>
											{item.payload.content}
										</div>
									)}

									<MessageAttachments attachments={item.payload.attachments} />
								</>
							)}

						</div>
					</div>
				)
			})}

			{replyJumpNotice && (
				<div className={styles["reply-jump-notice"]}>{replyJumpNotice}</div>
			)}

			{contextMenu && (
				<div
					className={cn(styles["context-menu"], styles["menu-animate"])}
					style={{ top: contextMenu.y, left: contextMenu.x }}
					onClick={(e) => e.stopPropagation()}
				>
					<button
						onClick={() => {
							const msg = messages.find(m => m.id === contextMenu.messageId);
							if (msg) handleStartReply(msg);
							setContextMenu(null);
						}}>
						Reply
					</button>

					{messages.find(m => m.id === contextMenu.messageId)?.senderId === myUser?.id && (
						<>
							<div className={styles["menu-divider"]} />
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
						</>
					)}
				</div>
			)}
		</div>
	)
}
