import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import styles from "./ChannelItemList.module.css";
import type { AppDispatch, RootState } from "../../store/store";
import { formatDate, formatTime, isSameDay } from "../../utils/timeHelpers";
import { MessagesSkeleton } from "../MessagesSkeleton/MessagesSkeleton";
import type { ChannelItemListProps } from "./ChannelItemList.props";
import { channelMessageActions, fetchChannelMessages } from "../../store/slices/channelMessage.slice";
import { useDispatch, useSelector } from "react-redux";
import type { ChannelMessage } from "../../entities/channelMessage";

type ContextMenuState = {
	x: number;
	y: number;
	messageId: number;
} | null;

export function ChannelItemList({ serverId, channelFolderId, channelId }: ChannelItemListProps) {
	const dispatch = useDispatch<AppDispatch>();
	const scrollRef = useRef<HTMLDivElement>(null);
	const { status, isAtBottom, messages, oldestMessageId, hasMore } = useSelector((s: RootState) => s.channelMessage)
	const { myUser } = useSelector((s: RootState) => s.user);
	const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

	useEffect(() => {
		dispatch(channelMessageActions.setIsAtBottom(true))
	}, [channelId])

	useEffect(() => {
		if (status === "succeeded" && scrollRef.current &&
			isAtBottom) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [status, messages, isAtBottom, channelId])

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
		const atBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 60;

		//isAtBottom.current = atBottom;
		if (isAtBottom !== atBottom) {
			dispatch(channelMessageActions.setIsAtBottom(atBottom));
		}

		if (container.scrollTop === 0 && hasMore && status !== "loading") {
			const scrollHeightBefore = container.scrollHeight;

			await dispatch(fetchChannelMessages({
				serverId: Number(serverId),
				channelFolderId: Number(channelFolderId),
				channelId: Number(channelId),
				beforeMessageId: oldestMessageId || undefined,
				limit: 15
			}));

			if (scrollRef.current) {
				const scrollHeightAfter = scrollRef.current.scrollHeight;
				const heighDifference = scrollHeightAfter - scrollHeightBefore;
				scrollRef.current.scrollTop = heighDifference;
			}
		}
	}
/*
	const handleDelete = (messageId: number) => {
		dispatch(channelMessageActions.deleteMessage({ messageId }));
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
*/
	const openContextMenu = (e: React.MouseEvent, msg: ChannelMessage) => {
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
			{ type: "msg"; payload: ChannelMessage; key: string })[] = [];

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

			itemArr.push({ type: "msg", payload: currentMsg, key: `${currentMsg.id}` });
		}

		return itemArr;
	}, [messages, channelId])

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
	//			const isEditing = editingMsgId === item.payload.id;
				const isEdited = item.payload.eventType === "MESSAGE_EDIT" || item.payload.editedAt !== null;

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

								<div className={styles["msg-text"]}>
									{item.payload.content}
								</div>

						</div>
					</div>
				)
			})}

		</div>
	)
}
