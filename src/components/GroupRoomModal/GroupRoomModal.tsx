import { Search, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { StringToColor } from "../../utils/stringHelpers";
import styles from "./GroupRoomModal.module.css";
import type { GroupRoomModalProps } from "./GroupRoomModal.props";

function getFriendUsername(friendId: number, username?: string | null) {
	return username ?? `user-${friendId}`;
}

export function GroupRoomModal({
	isOpen,
	friends,
	onClose,
	onCreate,
}: GroupRoomModalProps) {
	const [name, setName] = useState("");
	const [selected, setSelected] = useState<string[]>([]);
	const [query, setQuery] = useState("");
	const isVisible = useModalAnimation(isOpen);

	const selectedFriends = useMemo(
		() => friends.filter((friend) => selected.includes(getFriendUsername(friend.friendId, friend.friendUsername))),
		[friends, selected]
	);

	const filtered = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) return friends;

		return friends.filter((friend) => {
			const displayName = friend.friendDisplayName ?? "";
			const username = friend.friendUsername ?? "";

			return (
				displayName.toLowerCase().includes(normalizedQuery) ||
				username.toLowerCase().includes(normalizedQuery)
			);
		});
	}, [friends, query]);

	if (!isVisible) return null;

	const toggle = (username: string) => {
		setSelected((previous) => {
			if (previous.includes(username)) {
				return previous.filter((item) => item !== username);
			}

			return previous.length < 15 ? [...previous, username] : previous;
		});
	};

	const canCreate = name.trim().length > 0 && selected.length >= 2;

	return (
		<div
			className={styles.backdrop}
			data-state={isOpen ? "open" : "close"}
			onClick={onClose}
		>
			<div
				className={styles.modal}
				data-state={isOpen ? "open" : "close"}
				onClick={(event) => event.stopPropagation()}
			>
				<header className={styles.header}>
					<div className={styles.headerIcon}>
						<Users size={20} />
					</div>
					<div>
						<h3>Создать группу</h3>
						<p>Выберите минимум двух друзей и задайте название комнаты.</p>
					</div>
				</header>

				<div className={styles.body}>
					<label className={styles.field}>
						<span>Название</span>
						<input
							className={styles.input}
							placeholder="Например: Команда проекта"
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
					</label>

					<div className={styles.selectedBlock}>
						<div className={styles.rowHeader}>
							<span>Выбрано</span>
							<strong>{selected.length} / 15</strong>
						</div>

						{selectedFriends.length === 0 ? (
							<div className={styles.emptySelected}>Пока никто не выбран</div>
						) : (
							<div className={styles.chips}>
								{selectedFriends.map((friend) => {
									const username = getFriendUsername(friend.friendId, friend.friendUsername);
									const displayName = friend.friendDisplayName ?? username;

									return (
										<button
											key={friend.friendId}
											type="button"
											className={styles.chip}
											onClick={() => toggle(username)}
										>
											<span>{displayName}</span>
											<X size={13} />
										</button>
									);
								})}
							</div>
						)}
					</div>

					<label className={styles.searchBox}>
						<Search size={16} />
						<input
							placeholder="Поиск друзей"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
					</label>

					<div className={styles.list}>
						{filtered.length === 0 ? (
							<div className={styles.emptyList}>Ничего не найдено</div>
						) : (
							filtered.map((friend) => {
								const username = getFriendUsername(friend.friendId, friend.friendUsername);
								const displayName = friend.friendDisplayName ?? username;
								const isSelected = selected.includes(username);

								return (
									<button
										key={friend.friendId}
										type="button"
										className={styles.friendRow}
										data-selected={isSelected}
										onClick={() => toggle(username)}
									>
										<div
											className={styles.avatar}
											style={{ backgroundColor: StringToColor(username) }}
										>
											{friend.friendAvatarUrl ? (
												<img src={friend.friendAvatarUrl} alt={displayName} />
											) : (
												<span>{displayName[0]?.toUpperCase()}</span>
											)}
										</div>
										<div className={styles.friendMeta}>
											<strong>{displayName}</strong>
											<span>@{username}</span>
										</div>
										<span className={styles.checkmark}>{isSelected ? "✓" : ""}</span>
									</button>
								);
							})
						)}
					</div>
				</div>

				<footer className={styles.footer}>
					<button className={styles["btn-secondary"]} onClick={onClose}>
						Отмена
					</button>
					<button
						className={styles["btn-primary"]}
						disabled={!canCreate}
						onClick={() => {
							if (!canCreate) return;
							onCreate({ roomName: name.trim(), roomMemberUsernames: selected });
						}}
					>
						Создать
					</button>
				</footer>
			</div>
		</div>
	);
}
