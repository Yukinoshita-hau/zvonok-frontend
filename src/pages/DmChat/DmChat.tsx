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
import { Phone, Send, SettingsIcon, UserPlus, X } from "lucide-react";
import { RoomSettingModal } from "../../components/RoomSettingModal/RoomSettingModal";
import { StringToColor } from "../../utils/stringHelpers";
import { friendActions } from "../../store/slices/friend.slice";
import { UserMiniCard } from "../../components/UserMiniCard/UserMiniCard";
import type { UserCardRelationship } from "../../components/UserMiniCard/UserMiniCard.props";

export function DmChat() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const dispatch = useDispatch<AppDispatch>();

	const { rooms } = useSelector((s: RootState) => s.room);
	const { myUser } = useSelector((s: RootState) => s.user);
	const { replyTarget } = useSelector((s: RootState) => s.message);
	const { friends, incomingRequests, outgoingRequests } = useSelector((s: RootState) => s.friend);

	const [text, setText] = useState("");
	const [isRoomSettingOpen, setIsRoomSettingOpen] = useState<boolean>(false);
	const [isProfileCardOpen, setIsProfileCardOpen] = useState(false);
	const [profileAnchor, setProfileAnchor] = useState<DOMRect | null>(null);

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

	const relationship = useMemo<UserCardRelationship>(() => {
		if (!interlocutor || !myUser) return "none";
		if (interlocutor.id === myUser.id) return "self";
		if (friends.some((friend) => friend.friendUsername === interlocutor.username)) return "friend";
		if (outgoingRequests.some((request) => request.receiverUsername === interlocutor.username)) return "outgoing";
		if (incomingRequests.some((request) => request.senderUsername === interlocutor.username)) return "incoming";
		return "none";
	}, [friends, incomingRequests, interlocutor, myUser, outgoingRequests]);

	const onSend = () => {
		if (!text.trim() || !roomId) return;

		dispatch(
			messageActions.sendMessage({
				roomId: roomId,
				content: {
					content: text.trim(),
					replyToMessageId: replyTarget?.messageId ?? null
				}
			})
		);

		setText("");
		dispatch(messageActions.cancelReply());
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

	const handleHeaderIdentityClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		setProfileAnchor(event.currentTarget.getBoundingClientRect());
		setIsProfileCardOpen(true);
	};

	const handleAddFriend = () => {
		if (!interlocutor) return;
		dispatch(friendActions.sendFriendRequest({ username: interlocutor.username }));
		setIsProfileCardOpen(false);
	};

	const handleRemoveFriend = () => {
		if (!interlocutor) return;
		dispatch(friendActions.removeFriend({ friendUsername: interlocutor.username }));
		setIsProfileCardOpen(false);
	};

	const isPrivateRoom = currentRoom?.type === "PRIVATE";

	return (
		<div className={styles["chat"]}>
			<div className={styles["header"]}>
				<div className={styles["header-left"]}>
					<button
						type="button"
						className={styles["identity-button"]}
						onClick={handleHeaderIdentityClick}
					>
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
					</button>
				</div>

				<div className={styles["header-right"]}>
					{isPrivateRoom && relationship === "none" && (
						<button className={styles["btn"]} onClick={handleAddFriend} aria-label="Add friend">
							<UserPlus color="white" size={18} />
						</button>
					)}
					<button className={styles["btn"]} onClick={handleStartCall} aria-label="Start voice call">
						<Phone color="white" size={20} />
					</button>
					<button className={styles["btn"]} onClick={handleOpenChatSetting} aria-label="Chat settings">
						<SettingsIcon color="white" size={20} />
					</button>
				</div>
			</div>

			{currentRoom && (
				<RoomSettingModal
					isOpen={isRoomSettingOpen}
					onClose={() => setIsRoomSettingOpen(false)}
					onStartCall={handleStartCall}
					room={currentRoom}
				/>
			)}

			{isPrivateRoom && interlocutor && (
				<UserMiniCard
					isOpen={isProfileCardOpen}
					displayName={interlocutor.displayName}
					username={interlocutor.username}
					avatarUrl={interlocutor.avatarUrl}
					aboutMe={null}
					statusLabel={interlocutor.status}
					avatarBg={avatarBg}
					relationship={relationship}
					anchorRect={profileAnchor}
					onClose={() => setIsProfileCardOpen(false)}
					onMessage={() => setIsProfileCardOpen(false)}
					onAddFriend={handleAddFriend}
					onRemoveFriend={handleRemoveFriend}
				/>
			)}

			<DmItemsList />

			<div className={styles["input-bar"]}>
				{replyTarget && (
					<div className={styles["reply-preview"]}>
						<div className={styles["reply-preview-content"]}>
							<span className={styles["reply-label"]}>
								Replying to {replyTarget.authorDisplayName}
							</span>
							<span className={styles["reply-snippet"]}>
								{replyTarget.deleted
									? "Original message was deleted"
									: replyTarget.snippet || "Message unavailable"}
							</span>
						</div>
						<button
							className={styles["reply-cancel"]}
							onClick={() => dispatch(messageActions.cancelReply())}
							aria-label="Cancel reply"
						>
							<X size={14} />
						</button>
					</div>
				)}
				<div className={styles["composer-row"]}>
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
		</div>
	);
}
