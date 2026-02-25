import { Outlet, useNavigate } from "react-router-dom";
import styles from "./InboxLayout.module.css";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { createGroupRoom, fetchMyRooms } from "../../store/slices/room.slice";
import { RoomsList } from "../../components/RoomsList/RoomsList";
import { InboxHeaderButton } from "../../components/InboxHeaderButton/InboxHeaderButton";
import { fetchMyFriends, sendFriendRequest } from "../../store/slices/friend.slice";
import type { CreateGroupBody } from "../../api/interfaces/CreateGroupBody";
import { GroupRoomModal } from "../../components/GroupRoomModal/GroupRoomModal";
import { FriendRequestModal } from "../../components/FriendRequestModal/FriendRequestModal";
import { FriendsList } from "../../components/FriendsList/FriendsList";

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
	const { rooms } = room;
	const { friends } = friend

	useEffect(() => {
		if (room.status === "idle") {
			dispatch(fetchMyRooms())
		}
	}, [dispatch, room.status])

	useEffect(() => {
		if (friend.status === "idle") {
			dispatch(fetchMyFriends())
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
		dispatch(sendFriendRequest(username));
		setIsFriendModalOpen(false);
	}

	const handleCreateGroup = async (body: CreateGroupBody) => {
		await dispatch(createGroupRoom(body));
		dispatch(fetchMyRooms());
		setIsRoomModalOpen(false);
	}

	const sortedRooms = useMemo(() => {
		return [...rooms].sort((a, b) => {
			const dateA = new Date(a.lastActivityAt || 0).getTime();
			const dateB = new Date(b.lastActivityAt || 0).getTime();
			// console.log(`Сравниваем: ${a.name} (${dateA}) и ${b.name} (${dateB})`);
			if (filterMode === "Newest") {
				return dateB - dateA;
			} else {
				return dateA - dateB
			}
		})
	}, [rooms, filterMode])

	const sortedFriends = useMemo(() => {
		return [...friends].sort((a, b) => {
			const dateA = new Date(a.friendshipSince || 0).getTime();
			const dateB = new Date(b.friendshipSince || 0).getTime();
			console.log(`Сравниваем: ${a.friendUsername} (${dateA}) и ${b.friendUsername} (${dateB})`);
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
			navigate(`${existing.id}`)
		} else {
			navigate(`/dm/${friendUsername}`)
		}
	}

	return (
		<div className={styles["layout"]} >
			<div className={styles["sidebar"]}>
				<div className={styles["inbox-header"]}>
					<InboxHeaderButton isActive={buttonMode === "Messages"} onClick={() => setButtonMode("Messages")}>
						Messages
					</InboxHeaderButton>
					<InboxHeaderButton isActive={buttonMode === "Friends"} onClick={() => setButtonMode("Friends")}>
						Friends
					</InboxHeaderButton>
				</div>
				<div className={styles["messages-header"]}>
					<button className={styles["messages-header-filter"]}
						onClick={() => setFilterMode(filterMode === "Newest" ? "Oldest" : "Newest")}>
						<img src="../../../public/inbox-message-filter-icon.png" alt="inbox icon" />
						{filterMode}
					</button>

					<button className={styles["add-button"]} onClick={handleAddClick}>
						<img src="../../../public/add-room-icon.png" />
					</button>
				</div>

				<div className={styles["room-list"]}>
					{buttonMode == "Messages" ? (
						<RoomsList rooms={sortedRooms} />
					) : (
						<FriendsList friends={sortedFriends} onClick={handleFriendClick} />
					)}
				</div>
			</div>

			{<GroupRoomModal isOpen={isRoomModalOpen} friends={sortedFriends} onClose={() => setIsRoomModalOpen(false)} onCreate={handleCreateGroup} />}
			{<FriendRequestModal isOpen={isFriendModalOpen} onClose={() => setIsFriendModalOpen(false)} onSubmit={handleSendFriendRequest} />}

			<div className={styles["chat"]}>
				<Outlet />
			</div>
		</div>
	)
}
