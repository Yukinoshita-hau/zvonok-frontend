import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { ArrowDownWideNarrow, Users, UserPlus } from "lucide-react";
import type { AppDispatch, RootState } from "../../store/store";
import { friendActions, fetchMyFriends } from "../../store/slices/friend.slice";
import { InboxHeaderButton } from "../../components/InboxHeaderButton/InboxHeaderButton";
import { FriendRequestsList } from "../../components/FriendRequestsList/FriendRequestList";
import { FriendListItem } from "../../components/FriendListItem/FriendListItem";
import { FriendRequestModal } from "../../components/FriendRequestModal/FriendRequestModal";
import { UserMiniProfileModal } from "../../components/UserMiniProfileModal/UserMiniProfileModal";
import styles from "./ChatPlaceholder.module.css";

export function ChatPlaceholder() {
	const dispatch = useDispatch<AppDispatch>();
	const navigate = useNavigate();
	const { friends, incomingRequests, outgoingRequests, status } = useSelector(
		(s: RootState) => s.friend,
	);
	const users = useSelector((s: RootState) => s.users.byId);
	const [query, setQuery] = useState("");
	const rooms = useSelector((s: RootState) => s.room.rooms);
	const [mode, setMode] = useState<"all" | "online" | "incoming" | "outgoing">(
		"all",
	);
	const [addOpen, setAddOpen] = useState(false);
	const [profileId, setProfileId] = useState<number | null>(null);
	const [newestFirst, setNewestFirst] = useState(true);
	const sortedFriends = useMemo(
		() =>
			friends
				.filter((f) => {
					const user = users[f.friendId];
					return (
						(mode !== "online" ||
							(user?.status ?? f.friendStatus) === "ONLINE") &&
						`${user?.displayName ?? f.friendDisplayName} ${user?.username ?? f.friendUsername}`
							.toLocaleLowerCase()
							.includes(query.toLocaleLowerCase().trim())
					);
				})
				.sort((a, b) => {
					const delta =
						new Date(b.friendshipSince || 0).getTime() -
						new Date(a.friendshipSince || 0).getTime();
					return newestFirst ? delta : -delta;
				}),
		[friends, newestFirst, users, query, mode],
	);
	const requests = mode === "incoming" ? incomingRequests : outgoingRequests;
	const openFriend = (friendId: number) => {
		const room = rooms.find(
			(r) => r.type === "PRIVATE" && r.memberIds.includes(friendId),
		);
		if (room) navigate(`/dm?roomId=${room.id}`);
		else setProfileId(friendId);
	};

	return (
		<div className={styles.placeholder}>
			<header className={styles.header}>
				<div className={styles.heading}>
					<Users size={22} />
					<h1>Друзья</h1>
				</div>
				<div className={styles.tabs}>
					<InboxHeaderButton
						isActive={mode === "all"}
						onClick={() => setMode("all")}
					>
						Все
					</InboxHeaderButton>
					<InboxHeaderButton
						isActive={mode === "online"}
						onClick={() => setMode("online")}
					>
						В сети
					</InboxHeaderButton>
					<InboxHeaderButton
						isActive={mode === "incoming"}
						onClick={() => setMode("incoming")}
					>
						Входящие{" "}
						{incomingRequests.length > 0 && (
							<span className={styles.badge}>{incomingRequests.length}</span>
						)}
					</InboxHeaderButton>
					<InboxHeaderButton
						isActive={mode === "outgoing"}
						onClick={() => setMode("outgoing")}
					>
						Исходящие{" "}
						{outgoingRequests.length > 0 && (
							<span className={styles.badge}>{outgoingRequests.length}</span>
						)}
					</InboxHeaderButton>
				</div>
				<button
					className={styles.add}
					aria-label="Добавить друга"
					onClick={() => setAddOpen(true)}
				>
					<UserPlus size={16} />
					<span>Добавить друга</span>
				</button>
			</header>
			<div className={styles.list}>
				{(mode === "all" || mode === "online") && (
					<input
						className={styles.search}
						type="search"
						aria-label="Поиск друзей"
						placeholder="Поиск друзей"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
				)}
				<div className={styles.listHeading}>
					<h2 className={styles.label}>
						{mode === "all" || mode === "online"
							? `${mode === "online" ? "В сети" : "Все друзья"} — ${sortedFriends.length}`
							: `${mode === "incoming" ? "Входящие" : "Исходящие"} — ${requests.length}`}
					</h2>
					{(mode === "all" || mode === "online") && (
						<button
							className={styles.sort}
							aria-label="Изменить порядок друзей"
							aria-pressed={!newestFirst}
							onClick={() => setNewestFirst(!newestFirst)}
						>
							<ArrowDownWideNarrow size={14} />
							{newestFirst ? "Сначала новые" : "Сначала старые"}
						</button>
					)}
				</div>
				{mode === "all" || mode === "online" ? (
					sortedFriends.map((f) => (
						<FriendListItem key={f.friendId} friend={f} onClick={openFriend} />
					))
				) : (
					<FriendRequestsList
						requestsList={requests}
						mode={mode === "incoming" ? "incoming" : "outgoing"}
					/>
				)}
				{status === "loading" && <p role="status">Загрузка друзей…</p>}
				{status === "failed" && (
					<div role="alert">
						Не удалось загрузить друзей.{" "}
						<button
							className={styles.add}
							onClick={() => dispatch(fetchMyFriends())}
						>
							Повторить
						</button>
					</div>
				)}
				{status === "succeeded" &&
					(mode === "all" || mode === "online"
						? sortedFriends.length === 0
						: requests.length === 0) && (
						<div className={styles.empty}>
							<Users size={56} strokeWidth={1.2} />
							<h2>
								{mode === "all" || mode === "online"
									? query
										? "Никого не найдено"
										: mode === "online"
											? "Друзей в сети пока нет"
											: "Общение начинается с друзей"
									: "Пока нет заявок"}
							</h2>
							<p>
								{mode === "all" || mode === "online"
									? "Добавьте друга по имени пользователя, чтобы начать переписку."
									: "Новые заявки появятся здесь."}
							</p>
							{(mode === "all" || mode === "online") && (
								<button
									className={styles.add}
									aria-label="Добавить друга"
									onClick={() => setAddOpen(true)}
								>
									Добавить друга
								</button>
							)}
						</div>
					)}
			</div>
			<FriendRequestModal
				isOpen={addOpen}
				onClose={() => setAddOpen(false)}
				onSubmit={(username) => {
					dispatch(friendActions.sendFriendRequest({ username }));
					setAddOpen(false);
				}}
			/>
			<UserMiniProfileModal
				userId={profileId}
				isOpen={profileId !== null}
				onClose={() => setProfileId(null)}
			/>
		</div>
	);
}
