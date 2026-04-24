import { Outlet, useNavigate } from "react-router-dom";
import styles from "./InboxLayout.module.css";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { createGroupRoom, fetchMyRooms } from "../../store/slices/room.slice";
import { InboxHeaderButton } from "../../components/InboxHeaderButton/InboxHeaderButton";
import { fetchIncomingRequests, fetchMyFriends, fetchOutgoingRequests, friendActions } from "../../store/slices/friend.slice";
import type { CreateGroupBody } from "../../api/interfaces/CreateGroupBody";
import { GroupRoomModal } from "../../components/GroupRoomModal/GroupRoomModal";
import { FriendRequestModal } from "../../components/FriendRequestModal/FriendRequestModal";
import { RoomListItem } from "../../components/RoomListItem/RoomListItem";
import { FriendListItem } from "../../components/FriendListItem/FriendListItem";

export type buttonModeType = "Messages" | "Friends";

export function InboxLayout() {
	const navigate = useNavigate();
	const [filterMode, setFilterMode] = useState<"Newest" | "Oldest">("Newest");
	const [buttonMode, setButtonMode] = useState<buttonModeType>("Messages");
	const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
	const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);

	const dispatch = useDispatch<AppDispatch>();

	const room = useSelector((s: RootState) => s.room);
	const friend = useSelector((s: RootState) => s.friend)
	const call = useSelector((s: RootState) => s.call);
	const isCallActive = call.status === "connecting" || call.status === "in_call";

	const isFocusMode =
		isCallActive &&
		call.presentationMode === "expanded" &&
		call.isCallFocusMode;

	const { rooms } = room;
	const { friends } = friend
	const unreadRoomCount = room.rooms.filter(r => r.unreadCount > 0).length;

	useEffect(() => {
		if (room.status === "idle") {
			dispatch(fetchMyRooms())
		}
	}, [dispatch, room.status])

	useEffect(() => {
		if (friend.status === "idle") {
			dispatch(fetchMyFriends())
			dispatch(fetchIncomingRequests())
			dispatch(fetchOutgoingRequests())
		}
	}, [dispatch, friend.status])

	useEffect(() => {
		if (buttonMode === "Messages") {
			setIsFriendModalOpen(false);
		} else {
			setIsRoomModalOpen(false)
		}
	}, [buttonMode])

	const handleAddClick = () => {
		if (buttonMode === "Messages") {
			setIsRoomModalOpen(true);
		} else {
			setIsFriendModalOpen(true);
		}
	}

	const handleSendFriendRequest = (username: string) => {
		dispatch(friendActions.sendFriendRequest({ username: username }))
		setIsFriendModalOpen(false);
	}

	const handleCreateGroup = async (body: CreateGroupBody) => {
		await dispatch(createGroupRoom(body)).unwrap();
		dispatch(fetchMyRooms());
		setIsRoomModalOpen(false);
	}

	const sortedRooms = useMemo(() => {
		return [...rooms].sort((a, b) => {
			const dateA = new Date(a.lastActivityAt || 0).getTime();
			const dateB = new Date(b.lastActivityAt || 0).getTime();
			if (filterMode === "Newest") {
				return dateB - dateA;
			} else {
				return dateA - dateB
			}
		}).filter(r => r.type === "PRIVATE" && r.lastMessageId === null ? false: true)
	}, [rooms, filterMode])

	const sortedFriends = useMemo(() => {
		return [...friends].sort((a, b) => {
			const dateA = new Date(a.friendshipSince || 0).getTime();
			const dateB = new Date(b.friendshipSince || 0).getTime();
			if (filterMode === "Newest") {
				return dateB - dateA;
			} else {
				return dateA - dateB
			}
		})
	}, [friends, filterMode])

	const handleFriendClick = (friendUsername: string) => {
		const existing = rooms.find(r =>
			r.type === "PRIVATE" &&
			r.members?.some(m => m.username === friendUsername)
		)

		if (existing) {
			navigate(`/dm?roomId=${existing.id}`)
		} else {
			navigate(`/`)
		}
	}

	return (
		<div
			className={[
				styles["layout"],
				isFocusMode ? styles["layout-focus"] : "",
			].join(" ")}
		>
			<div className={styles["sidebar"]}>
				<div className={styles["inbox-header"]}>
					<InboxHeaderButton isActive={buttonMode === "Messages"} onClick={() => setButtonMode("Messages")}>
						Messages
						{unreadRoomCount > 0 && (
							<span className={styles["messages-badge"]}>{unreadRoomCount}</span>
						)}
					</InboxHeaderButton>
					<InboxHeaderButton isActive={buttonMode === "Friends"} onClick={() => setButtonMode("Friends")}>
						Friends
					</InboxHeaderButton>
				</div>

				<div className={styles["messages-header"]}>
					<button
						className={styles["messages-header-filter"]}
						onClick={() => setFilterMode(filterMode === "Newest" ? "Oldest" : "Newest")}
					>
						<img src="/inbox-message-filter-icon.png" alt="inbox icon" />
						{filterMode}
					</button>

					<button className={styles["add-button"]} onClick={handleAddClick}>
						<img src="/add-room-icon.png" alt="Add" />
					</button>
				</div>

				<div className={styles["item-list"]}>
					{buttonMode === "Messages" ? (
						<div className={styles["room-list"]}>
							{sortedRooms.map(r => (
								<RoomListItem
									key={r.id}
									room={r}
								/>
							))}
						</div>
					) : (
						<div className={styles["friend-list"]}>
							{sortedFriends.map(f => (
								<FriendListItem 
								key={f.friendId}
								friend={f}
								onClick={handleFriendClick} />
							))}
						</div>
					)}
				</div>
			</div>

			<GroupRoomModal
				isOpen={isRoomModalOpen}
				friends={sortedFriends}
				onClose={() => setIsRoomModalOpen(false)}
				onCreate={handleCreateGroup}
			/>
			<FriendRequestModal
				isOpen={isFriendModalOpen}
				onClose={() => setIsFriendModalOpen(false)}
				onSubmit={handleSendFriendRequest}
			/>

			<div className={styles["chat"]}>
				<Outlet />
			</div>
		</div>
	);
}
