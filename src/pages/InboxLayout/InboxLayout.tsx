import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ArrowDownWideNarrow, MessageCircle, Plus, Users } from "lucide-react";
import type { AppDispatch, RootState } from "../../store/store";
import { createGroupRoom, fetchMyRooms } from "../../store/slices/room.slice";
import {
	fetchIncomingRequests,
	fetchMyFriends,
	fetchOutgoingRequests,
} from "../../store/slices/friend.slice";
import type { CreateGroupBody } from "../../api/interfaces/CreateGroupBody";
import { GroupRoomModal } from "../../components/GroupRoomModal/GroupRoomModal";
import { RoomListItem } from "../../components/RoomListItem/RoomListItem";
import styles from "./InboxLayout.module.css";
import { SettingsContentSlot } from "../../features/settingsV2/SettingsContentSlot";

export function InboxLayout() {
	const navigate = useNavigate();
	const location = useLocation();
	const dispatch = useDispatch<AppDispatch>();
	const [newestFirst, setNewestFirst] = useState(true);
	const [groupOpen, setGroupOpen] = useState(false);
	const room = useSelector((s: RootState) => s.room);
	const friend = useSelector((s: RootState) => s.friend);
	const call = useSelector((s: RootState) => s.call);
	const focus =
		(call.status === "connecting" || call.status === "in_call") &&
		call.presentationMode === "expanded" &&
		(call.isCallFocusMode || call.isTheaterMode);
	const unread = room.rooms.filter((r) => r.unreadCount > 0).length;
	const active = call.status === "connecting" || call.status === "in_call";

	useEffect(() => {
		if (room.status === "idle") dispatch(fetchMyRooms());
	}, [dispatch, room.status]);
	useEffect(() => {
		if (friend.status === "idle") {
			dispatch(fetchMyFriends());
			dispatch(fetchIncomingRequests());
			dispatch(fetchOutgoingRequests());
		}
	}, [dispatch, friend.status]);

	const sortedRooms = useMemo(
		() =>
			[...room.rooms].sort((a, b) => {
				const delta =
					new Date(b.lastActivityAt || 0).getTime() -
					new Date(a.lastActivityAt || 0).getTime();
				return newestFirst ? delta : -delta;
			}),
		[room.rooms, newestFirst],
	);

	const createGroup = async (body: CreateGroupBody) => {
		const created = await dispatch(createGroupRoom(body)).unwrap();
		dispatch(fetchMyRooms());
		setGroupOpen(false);
		navigate(`/dm?roomId=${created.id}`);
	};

	return (
		<div className={`${styles.layout} ${focus ? styles.focus : ""}`}>
			<aside className={styles.sidebar} aria-label="Личные сообщения и группы">
				<header className={styles.header}>
					<span>ZVONOK</span>
					<small>Личное пространство</small>
				</header>
				<div className={styles.navigation}>
					<button
						className={styles.friends}
						aria-current={location.pathname === "/" ? "page" : undefined}
						onClick={() => navigate("/")}
					>
						<Users size={21} />
						<span>Друзья</span>
						{friend.incomingRequests.length > 0 && (
							<b className={styles.badge}>{friend.incomingRequests.length}</b>
						)}
					</button>
				</div>
				<div className={styles.label}>
					<span>
						Личные сообщения{" "}
						{unread > 0 && <b className={styles.badge}>{unread}</b>}
					</span>
					<button
						title="Создать группу"
						aria-label="Создать группу"
						onClick={() => setGroupOpen(true)}
					>
						<Plus size={17} />
					</button>
				</div>
				<button
					className={styles.sort}
					title="Изменить порядок переписок"
					onClick={() => setNewestFirst(!newestFirst)}
				>
					<ArrowDownWideNarrow size={14} />
					{newestFirst ? "Сначала новые" : "Сначала старые"}
				</button>
				<div className={styles.list}>
					{sortedRooms.map((r) => (
						<RoomListItem key={r.id} room={r} />
					))}
					{room.status === "loading" && (
						<p className={styles.empty} role="status">
							Загрузка переписок…
						</p>
					)}
					{room.status === "failed" && (
						<div className={styles.empty} role="alert">
							Не удалось загрузить переписки.
							<button onClick={() => dispatch(fetchMyRooms())}>
								Повторить
							</button>
						</div>
					)}
					{room.status === "succeeded" && !sortedRooms.length && (
						<div className={styles.empty}>
							<MessageCircle size={24} />
							<p>Здесь будут ваши переписки.</p>
							<p>Выберите друга, чтобы начать общение.</p>
						</div>
					)}
				</div>
				{active && <div className={styles.callSpace} />}
			</aside>
			<GroupRoomModal
				isOpen={groupOpen}
				friends={friend.friends}
				onClose={() => setGroupOpen(false)}
				onCreate={createGroup}
			/>
			<main className={styles.chat}>
				<SettingsContentSlot>
					{!(active && call.presentationMode === "expanded") && <Outlet />}
				</SettingsContentSlot>
			</main>
		</div>
	);
}
