import cn from "classnames";
import { createPortal } from "react-dom";
import { Reply, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import {
	isMessageContinuation,
	shouldSubmitMessage,
} from "./messagePresentation";
import { useVirtualRows } from "./useVirtualRows";
import {
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type UIEvent,
} from "react";
import styles from "./DmItemsList.module.css";
import {
	fetchRoomMessages,
	getMessagesReaders,
	messageActions,
    jumpToRoomMessage,
} from "../../store/slices/message.slice";
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

export function DmItemsList({ roomId: explicitRoomId, jumpId, onJumpHandled }: { roomId?: number; jumpId?: number | null; onJumpHandled?: () => void } = {}) {
	const [searchParams] = useSearchParams();
	const dispatch = useDispatch<AppDispatch>();
	const {
		messages,
		status,
		hasMore,
		oldestMessageId,
		isAtBottom,
		newDividerMessageId,
        jumpTargetId,
        historyContext,
	} = useSelector((s: RootState) => s.message);
	const { rooms } = useSelector((s: RootState) => s.room);
	const { myUser } = useSelector((s: RootState) => s.user);
	const usersById = useSelector((s: RootState) => s.users.byId);
	const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
	const [editContent, setEditContent] = useState("");
	const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
	const [highlightedMessageId, setHighlightedMessageId] = useState<
		number | null
	>(null);
	const [replyJumpNotice, setReplyJumpNotice] = useState<string | null>(null);

	const scrollRef = useRef<HTMLDivElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const menuTrigger = useRef<HTMLElement | null>(null);
	useLayoutEffect(() => {
		const menu = menuRef.current;
		if (!contextMenu || !menu) return;
		const x = Math.max(
			8,
			Math.min(contextMenu.x, window.innerWidth - menu.offsetWidth - 8),
		);
		const y = Math.max(
			8,
			Math.min(contextMenu.y, window.innerHeight - menu.offsetHeight - 8),
		);
		if (x !== contextMenu.x || y !== contextMenu.y)
			setContextMenu({ ...contextMenu, x, y });
		menu
			.querySelector<HTMLButtonElement>("button")
			?.focus({ preventScroll: true });
	}, [contextMenu]);
	const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
	const processedIdsRef = useRef<Set<number>>(new Set());
	const roomId = explicitRoomId != null ? String(explicitRoomId) : searchParams.get("roomId");
	const numericRoomId = Number(roomId);
	const activeRoomRef = useRef(numericRoomId);
	activeRoomRef.current = numericRoomId;
	const replyTimers = useRef<Set<number>>(new Set());
	const scheduleReplyEffect = (callback: () => void, delay: number) => {
		const timer = window.setTimeout(() => {
			replyTimers.current.delete(timer);
			callback();
		}, delay);
		replyTimers.current.add(timer);
	};
	const currentRoom = rooms?.find((r) => r.id === Number(roomId));
	const messagesById = useMemo(
		() => new Map(messages.map((message) => [message.id, message])),
		[messages],
	);

	const chatItems = useMemo(() => {
		const itemArr: (
			| { type: "divider"; label: string; rawDate: string; key: string }
			| {
					type: "msg";
					payload: ShortMessage;
					key: string;
					continuation: boolean;
			  }
		)[] = [];

		for (let i = 0; i < messages.length; i++) {
			const currentMsg = messages[i];
			const previousMsg = i === 0 ? null : messages[i - 1];

			if (
				(previousMsg !== null &&
					!isSameDay(currentMsg.sentAt, previousMsg.sentAt)) ||
				i === 0
			) {
				const now = new Date();
				const yesterday = new Date();
				yesterday.setDate(now.getDate() - 1);

				if (isSameDay(now, currentMsg.sentAt)) {
					itemArr.push({
						type: "divider",
						label: "Сегодня",
						rawDate: currentMsg.sentAt,
						key: `divider-${currentMsg.id}`,
					});
				} else if (isSameDay(yesterday, currentMsg.sentAt)) {
					itemArr.push({
						type: "divider",
						label: "Вчера",
						rawDate: currentMsg.sentAt,
						key: `divider-${currentMsg.id}`,
					});
				} else {
					itemArr.push({
						type: "divider",
						label: formatDate(currentMsg.sentAt),
						rawDate: currentMsg.sentAt,
						key: `divider-${currentMsg.id}`,
					});
				}
			}

			if (newDividerMessageId && messages[i].id === newDividerMessageId) {
				itemArr.push({
					type: "divider",
					label: "New",
					rawDate: "New",
					key: `date-divider-${currentMsg.id}`,
				});
			}

			itemArr.push({
				type: "msg",
				payload: currentMsg,
				key: `${currentMsg.id}`,
				continuation: isMessageContinuation(
					previousMsg,
					currentMsg,
					newDividerMessageId,
				),
			});
		}

		return itemArr;
	}, [messages, newDividerMessageId]);

	const windowed = useVirtualRows(
		chatItems,
		scrollRef,
		isAtBottom,
		editingMsgId === null ? undefined : String(editingMsgId),
	);
	const virtualEnabled = useRef(windowed.enabled);
    useEffect(() => {
        if (!jumpId || !numericRoomId) return;
        const task = dispatch(jumpToRoomMessage({ roomId: numericRoomId, messageId: jumpId }));
        void task.unwrap().catch(() => {
            setReplyJumpNotice('Сообщение удалено или доступ к нему потерян');
            scheduleReplyEffect(() => setReplyJumpNotice(null), 3000);
        }).finally(() => onJumpHandled?.());
        return () => task.abort();
    }, [jumpId, numericRoomId, dispatch]);
    useLayoutEffect(() => {
        if (!jumpTargetId || !messages.some(message => message.id === jumpTargetId)) return;
        windowed.scrollTo(String(jumpTargetId));
        const frame = requestAnimationFrame(() => {
            messageRefs.current.get(jumpTargetId)?.scrollIntoView({ block: 'center' });
            setHighlightedMessageId(jumpTargetId);
            dispatch(messageActions.jumpPositioned(jumpTargetId));
        });
        scheduleReplyEffect(() => setHighlightedMessageId(null), 1800);
        return () => cancelAnimationFrame(frame);
    }, [jumpTargetId, messages]);
	virtualEnabled.current = windowed.enabled;

	const lastMessageId = useMemo(() => {
		if (messages.length === 0) return null;
		return messages[messages.length - 1].id;
	}, [messages]);

	useEffect(() => {
		processedIdsRef.current.clear();
		return () => {
			replyTimers.current.forEach(window.clearTimeout);
			replyTimers.current.clear();
		};
	}, [roomId]);
	useEffect(() => {
		processedIdsRef.current.forEach((id) => {
			if (!messagesById.has(id)) processedIdsRef.current.delete(id);
		});
	}, [messagesById]);

	useEffect(() => {
		dispatch(messageActions.setIsAtBottom(true));
	}, [roomId]);

	// Removing the loading skeleton can expose the entire history without a scroll event.
	useLayoutEffect(() => {
		const container = scrollRef.current;
		if (
			status !== "succeeded" ||
			historyContext ||
			isAtBottom ||
			!container ||
			container.clientHeight === 0
		)
			return;
		if (
			container.scrollHeight - container.scrollTop - container.clientHeight <
			60
		) {
			dispatch(messageActions.setIsAtBottom(true));
		}
	}, [status, messages, roomId, isAtBottom, dispatch]);

	useEffect(() => {
		if (!scrollRef.current) return;
		if (status !== "succeeded") return;
		if (!isAtBottom) return;
		if (lastMessageId === null) return;

		scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
	}, [status, lastMessageId, isAtBottom, roomId]);

	useEffect(() => {
		if (
			currentRoom &&
			currentRoom.unreadCount > 0 &&
			newDividerMessageId === null &&
			currentRoom.firstUnreadMessageId != null
		) {
			dispatch(
				messageActions.setNewDividerMessageId(currentRoom.firstUnreadMessageId),
			);
		}
	}, [
		currentRoom?.unreadCount,
		currentRoom?.id,
		currentRoom?.firstUnreadMessageId,
		newDividerMessageId,
		dispatch,
	]);

	useEffect(() => {
		if (!contextMenu) return;
		const close = () => setContextMenu(null);
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				close();
				menuTrigger.current?.focus();
			}
		};
		window.addEventListener("click", close);
		window.addEventListener("resize", close);
		window.addEventListener("keydown", onKey);

		return () => {
			window.removeEventListener("click", close);
			window.removeEventListener("resize", close);
			window.removeEventListener("keydown", onKey);
		};
	}, [contextMenu]);

	useEffect(() => {
		setContextMenu(null);
		setEditingMsgId(null);
	}, [roomId]);

	const lastVisibleMessageId = useMemo(() => {
		if (messages.length === 0) return null;
		return messages[messages.length - 1].id;
	}, [messages]);

	useEffect(() => {
		if (!isAtBottom || lastVisibleMessageId === null) return;

		dispatch(
			messageActions.markMessageRead({
				messageId: lastVisibleMessageId,
			}),
		);
	}, [dispatch, isAtBottom, lastVisibleMessageId, myUser?.username]);

	useEffect(() => {
		if (isAtBottom && (currentRoom?.unreadCount ?? 0) > 0) {
			dispatch(markRoomAsRead({ roomId: numericRoomId }));
		}
	}, [dispatch, isAtBottom, currentRoom?.unreadCount, numericRoomId]);

	useEffect(() => {
		if (status !== "succeeded" || !messages.length || !myUser?.id) return;

		const newMessageIds = messages
			.slice(-15)
			.filter((msg) => msg.senderId === myUser.id)
			.map((msg) => msg.id);

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
					const currentMessage = messagesById.get(messageId);

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
			},
		);

		messageRefs.current.forEach((el, id) => {
			const msg = messagesById.get(id);
			if (!el || !msg) return;

			if (msg.senderId === myUser.id) return;
			if (msg.readBy?.includes(myUser.username)) return;
			if (processedIdsRef.current.has(id)) return;

			observer.observe(el);
		});

		return () => observer.disconnect();
	}, [
		messagesById,
		myUser?.id,
		myUser?.username,
		dispatch,
		windowed.first,
		windowed.last,
	]);

	const handleScroll = async (e: UIEvent<HTMLDivElement>) => {
		const container = e.currentTarget;
		const atBottom =
			container.scrollHeight - container.scrollTop - container.clientHeight <
			60;

		//isAtBottom.current = atBottom;
		if (isAtBottom !== atBottom) {
			dispatch(messageActions.setIsAtBottom(atBottom && !historyContext));
		}

		if (container.scrollTop === 0 && hasMore && status !== "loading") {
			const scrollHeightBefore = container.scrollHeight;

			await dispatch(
				fetchRoomMessages({
					roomId: Number(roomId),
					beforeMessageId: oldestMessageId || undefined,
				}),
			);

			if (
				scrollRef.current &&
				!virtualEnabled.current &&
				activeRoomRef.current === numericRoomId
			) {
				const scrollHeightAfter = scrollRef.current.scrollHeight;
				const heighDifference = scrollHeightAfter - scrollHeightBefore;
				scrollRef.current.scrollTop = heighDifference;
			}
		}
	};

	const handleDelete = (messageId: number) => {
		if (messagesById.get(messageId)?.senderId !== myUser?.id) return;
		dispatch(messageActions.deleteMessage({ messageId }));
	};

	const handleStartEdit = (messageId: number, currentContent: string) => {
		if (messagesById.get(messageId)?.senderId !== myUser?.id) return;
		setEditingMsgId(messageId);
		setEditContent(currentContent);
	};

	const handleSaveEdit = (messageId: number) => {
		if (!editContent.trim()) return;

		dispatch(
			messageActions.editMessage({
				messageId,
				newContent: editContent.trim(),
			}),
		);
		setEditingMsgId(null);
	};

	const handleCancelEdit = () => {
		setEditingMsgId(null);
		setEditContent("");
	};

	const getReplySnippet = (msg: ShortMessage) => {
		if (msg.replyPreview?.deleted) return "Original message was deleted";
		const fallback = msg.attachments.length > 0 ? "Вложение" : "";
		const source = msg.replyPreview?.snippet || msg.content || fallback;
		return source.replace(/\s+/g, " ").trim().slice(0, 120);
	};

	const handleStartReply = (msg: ShortMessage) => {
		if (msg.eventType === "MESSAGE_DELETE") return;

		const sender = usersById[msg.senderId];

		dispatch(
			messageActions.startReply({
				messageId: msg.id,
				authorDisplayName: sender?.displayName ?? "Unknown user",
				snippet: getReplySnippet(msg),
				deleted: msg.replyPreview?.deleted ?? false,
			}),
		);
	};

	const handleReplyJump = (msg: ShortMessage) => {
		if (!msg.replyToMessageId) return;

		const targetEl = messageRefs.current.get(msg.replyToMessageId);
		if (
			!targetEl &&
			windowed.enabled &&
			windowed.scrollTo(String(msg.replyToMessageId))
		) {
			setHighlightedMessageId(msg.replyToMessageId);
			scheduleReplyEffect(
				() =>
					setHighlightedMessageId((current) =>
						current === msg.replyToMessageId ? null : current,
					),
				1600,
			);
			return;
		}
		if (!targetEl) {
            void dispatch(jumpToRoomMessage({ roomId: numericRoomId, messageId: msg.replyToMessageId })).unwrap().catch(() => {
                setReplyJumpNotice('Сообщение удалено или недоступно');
                scheduleReplyEffect(() => setReplyJumpNotice(null), 2200);
            });
			return;
		}

		targetEl.scrollIntoView({
			behavior: "smooth",
			block: "center",
		});
		setHighlightedMessageId(msg.replyToMessageId);
		scheduleReplyEffect(() => {
			setHighlightedMessageId((current) =>
				current === msg.replyToMessageId ? null : current,
			);
		}, 1600);
	};

	const openContextMenu = (
		e: {
			preventDefault: () => void;
			currentTarget: EventTarget;
			clientX: number;
			clientY: number;
		},
		msg: ShortMessage,
	) => {
		e.preventDefault();

		if (msg.eventType === "MESSAGE_DELETE") return;
		menuTrigger.current = e.currentTarget as HTMLElement;
		const menuWidth = 200;
		const menuHeight = msg.senderId === myUser?.id ? 160 : 54;

		let x = e.clientX;
		let y = e.clientY;

		if (x + menuWidth > window.innerWidth)
			x = window.innerWidth - menuWidth - 10;
		if (y + menuHeight > window.innerHeight)
			y = window.innerHeight - menuHeight - 10;

		setContextMenu({
			x: Math.max(8, x),
			y: Math.max(8, y),
			messageId: msg.id,
		});
	};

	const renderItem = (item: (typeof chatItems)[number]) => {
		if (item.type === "divider") {
			return (
				<div
					className={styles["data-divider"]}
					key={item.key}
					ref={(element) => {
						if (!windowed.enabled) windowed.bind(item.key, element);
					}}
				>
					<span className={styles["data-label"]}>{item.label}</span>
				</div>
			);
		}

		const sender = usersById[item.payload.senderId];

		if (!sender) {
			console.warn("Sender not found for message:", item.payload);
			return null;
		}

		const isMyMessage = item.payload.senderId === myUser?.id;
		const isEditing = editingMsgId === item.payload.id;
		const isEdited =
			item.payload.eventType === "MESSAGE_EDIT" ||
			item.payload.editedAt !== null;

		return (
			<div
				key={item.key}
				ref={(el) => {
					if (!windowed.enabled) windowed.bind(item.key, el);
					if (el) messageRefs.current.set(item.payload.id, el);
					else messageRefs.current.delete(item.payload.id);
				}}
				data-id={item.payload.id}
				data-continuation={item.continuation}
				tabIndex={0}
				aria-label={`Сообщение от ${sender.displayName}, ${formatTime(item.payload.sentAt)}`}
				onKeyDown={(e) => {
					if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
						const rect = e.currentTarget.getBoundingClientRect();
						openContextMenu(
							{
								preventDefault: () => e.preventDefault(),
								currentTarget: e.currentTarget,
								clientX: rect.left + 60,
								clientY: rect.top,
							},
							item.payload,
						);
					}
				}}
				data-sender={sender.username}
				className={cn(
					styles["message-row"],
					item.continuation && styles["message-continuation"],
					highlightedMessageId === item.payload.id &&
						styles["message-row-highlighted"],
				)}
				onContextMenu={(e) => {
					openContextMenu(e, item.payload);
				}}
			>
				{item.continuation && (
					<span className={styles["continuation-time"]}>
						{formatTime(item.payload.sentAt)}
					</span>
				)}
				<div
					className={styles["msg-avatar"]}
					style={{ background: StringToColor(sender.username) }}
				>
					{sender.avatarUrl ? (
						<img src={resolveMediaUrl(sender.avatarUrl)} alt="" />
					) : (
						<div>{(sender.displayName?.[0] || "?").toUpperCase()}</div>
					)}
				</div>
				<div className={styles["msg-body"]}>
					<div className={styles["msg-meta"]}>
						<span className={styles["msg-author"]}>{sender.displayName}</span>
						{isMyMessage && (
							<div className={styles["read-status"]}>
								{item.payload.readBy?.length ? `✓✓` : "✓"}
							</div>
						)}
						<span className={styles["msg-time"]}>
							{formatTime(item.payload.sentAt)}
						</span>
						{isEdited && <span className={styles["edited-badge"]}>edited</span>}
					</div>
					{isEditing ? (
						<div className={styles["edit-box"]}>
							<textarea
								aria-label="Редактировать сообщение"
								className={styles["edit-input"]}
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								onKeyDown={(e) => {
									if (
										shouldSubmitMessage({
											key: e.key,
											shiftKey: e.shiftKey,
											isComposing: e.nativeEvent.isComposing,
											keyCode: e.keyCode,
										})
									) {
										e.preventDefault();
										handleSaveEdit(item.payload.id);
									}
									if (e.key === "Escape") handleCancelEdit();
								}}
								autoFocus
							/>
							<div className={styles["edit-actions"]}>
								<button
									className={styles["btn-primary"]}
									onClick={() => handleSaveEdit(item.payload.id)}
								>
									Save
								</button>
								<button
									className={styles["btn-secondary"]}
									onClick={() => handleCancelEdit()}
								>
									Cancel
								</button>
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
										{item.payload.replyPreview?.authorDisplayName ||
											"Unknown user"}
									</span>
									<span className={styles["reply-content"]}>
										{item.payload.replyPreview?.deleted
											? "Original message was deleted"
											: item.payload.replyPreview?.snippet ||
												"Original message unavailable"}
									</span>
								</button>
							)}

							{item.payload.content && (
								<div className={styles["msg-text"]}>
									{item.payload.content}
									{item.continuation && isEdited && (
										<span className={styles["edited-inline"]}> (изменено)</span>
									)}
								</div>
							)}

							<MessageAttachments attachments={item.payload.attachments} author={sender.displayName || sender.username} date={item.payload.sentAt} />
						</>
					)}
				</div>
				{!isEditing && item.payload.eventType !== "MESSAGE_DELETE" && (
					<div
						className={styles["msg-actions"]}
						aria-label="Действия сообщения"
					>
						<button
							aria-label="Ответить"
							title="Ответить"
							onClick={() => handleStartReply(item.payload)}
						>
							<Reply size={17} />
						</button>
						{isMyMessage && (
							<>
								<button
									aria-label="Редактировать"
									title="Редактировать"
									onClick={() =>
										handleStartEdit(item.payload.id, item.payload.content)
									}
								>
									<Pencil size={17} />
								</button>
								<button
									aria-label="Удалить"
									title="Удалить"
									onClick={() => handleDelete(item.payload.id)}
								>
									<Trash2 size={17} />
								</button>
							</>
						)}
						<button
							aria-label="Другие действия"
							title="Другие действия"
							onClick={(e) => {
								e.stopPropagation();
								const rect = e.currentTarget.getBoundingClientRect();
								openContextMenu(
									{
										preventDefault: () => e.preventDefault(),
										currentTarget: e.currentTarget,
										clientX: rect.left,
										clientY: rect.bottom,
									},
									item.payload,
								);
							}}
						>
							<MoreHorizontal size={17} />
						</button>
					</div>
				)}
			</div>
		);
	};

	return (
		<div
			className={styles["messages"]}
			style={windowed.enabled ? { overflowAnchor: "none" } : undefined}
			onScroll={handleScroll}
			ref={scrollRef}
		>
			{status === "loading" && messages.length === 0 && <MessagesSkeleton />}
			{status === "failed" && (
				<div role="alert" className={styles["list-notice"]}>
					Не удалось загрузить сообщения.{" "}
					<button
						onClick={() =>
							dispatch(fetchRoomMessages({ roomId: numericRoomId }))
						}
					>
						Повторить
					</button>
				</div>
			)}
			{status === "succeeded" && messages.length === 0 && (
				<div className={styles["list-notice"]}>
					Начало переписки. Отправьте первое сообщение.
				</div>
			)}
			{windowed.enabled ? (
				<div
					style={{
						height: windowed.total,
						position: "relative",
						flexShrink: 0,
						overflowAnchor: "none",
					}}
				>
					{windowed.rows.map(({ item, index }) => (
						<div
							key={item.key}
							data-virtual-key={item.key}
							ref={(element) => windowed.bind(item.key, element)}
							style={{
								position: "absolute",
								top: windowed.offsets[index],
								width: "100%",
								display: "flow-root",
								paddingBottom: 0,
								boxSizing: "border-box",
							}}
						>
							{renderItem(item)}
						</div>
					))}
				</div>
			) : (
				chatItems.map(renderItem)
			)}

            {historyContext && <button onClick={() => { dispatch(messageActions.clearMessages()); void dispatch(fetchRoomMessages({ roomId: numericRoomId })); }}>К новым сообщениям</button>}
			{replyJumpNotice && (
				<div className={styles["reply-jump-notice"]}>{replyJumpNotice}</div>
			)}

			{contextMenu &&
				createPortal(
					<div
						ref={menuRef}
						role="menu"
						aria-label="Действия сообщения"
						onKeyDown={(e) => {
							const buttons = Array.from(
								e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
							);
							const index = buttons.indexOf(
								document.activeElement as HTMLButtonElement,
							);
							if (
								["ArrowDown", "ArrowUp", "Home", "End", "Tab"].includes(e.key)
							) {
								e.preventDefault();
								if (e.key === "Tab") {
									setContextMenu(null);
									menuTrigger.current?.focus();
									return;
								}
								buttons[
									e.key === "Home"
										? 0
										: e.key === "End"
											? buttons.length - 1
											: (index +
													(e.key === "ArrowUp" ? -1 : 1) +
													buttons.length) %
												buttons.length
								]?.focus();
							}
						}}
						className={cn(styles["context-menu"], styles["menu-animate"])}
						style={{ top: contextMenu.y, left: contextMenu.x }}
						onClick={(e) => e.stopPropagation()}
					>
						<button
							role="menuitem"
							onClick={() => {
								const msg = messagesById.get(contextMenu.messageId);
								if (msg) handleStartReply(msg);
								setContextMenu(null);
							}}
						>
							Ответить
						</button>

						{messagesById.get(contextMenu.messageId)?.senderId ===
							myUser?.id && (
							<>
								<div className={styles["menu-divider"]} />
								<button
									role="menuitem"
									onClick={() => {
										const msg = messagesById.get(contextMenu.messageId);
										if (msg) handleStartEdit(msg.id, msg.content);
										setContextMenu(null);
									}}
								>
									Редактировать
								</button>

								<div className={styles["menu-divider"]} />

								<button
									role="menuitem"
									className={styles["danger"]}
									onClick={() => {
										handleDelete(contextMenu.messageId);
										setContextMenu(null);
									}}
								>
									Удалить
								</button>
							</>
						)}
					</div>,
					document.body,
				)}
		</div>
	);
}
