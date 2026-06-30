import { Search, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { StringToColor } from "../../utils/stringHelpers";
import styles from "./AddGroupMembersModal.module.css";
import type { AddGroupMembersModalProps } from "./AddGroupMembersModal.props";

export function AddGroupMembersModal({
	isOpen,
	friends,
	existingMemberIds,
	isSubmitting = false,
	onClose,
	onAdd,
}: AddGroupMembersModalProps) {
	const [query, setQuery] = useState("");
	const [selectedIds, setSelectedIds] = useState<number[]>([]);

	const availableFriends = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		const existingIds = new Set(existingMemberIds);

		return friends
			.filter((friend) => !existingIds.has(friend.friendId))
			.filter((friend) => {
				if (!normalizedQuery) return true;

				const username = friend.friendUsername ?? "";
				const displayName = friend.friendDisplayName ?? "";

				return (
					username.toLowerCase().includes(normalizedQuery) ||
					displayName.toLowerCase().includes(normalizedQuery)
				);
			});
	}, [existingMemberIds, friends, query]);

	if (!isOpen) return null;

	const toggleUser = (userId: number) => {
		setSelectedIds((previous) =>
			previous.includes(userId)
				? previous.filter((id) => id !== userId)
				: [...previous, userId],
		);
	};

	const handleAdd = () => {
		if (selectedIds.length === 0 || isSubmitting) return;

		onAdd(selectedIds);
	};

	return createPortal(
		<div className={styles.backdrop} onClick={onClose}>
			<div className={styles.modal} onClick={(event) => event.stopPropagation()}>
				<div className={styles.header}>
					<div>
						<h3>Добавить друзей</h3>
						<p>Выберите друзей, которых нужно добавить в группу.</p>
					</div>
					<button type="button" onClick={onClose} aria-label="Закрыть">
						<X size={18} />
					</button>
				</div>

				<label className={styles.searchBox}>
					<Search size={17} />
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Поиск по имени или username"
					/>
				</label>

				{selectedIds.length > 0 && (
					<div className={styles.selectedRow}>
						{selectedIds.map((userId) => {
							const friend = friends.find((item) => item.friendId === userId);
							return (
								<span key={userId}>
									{friend?.friendDisplayName ?? friend?.friendUsername ?? `user-${userId}`}
								</span>
							);
						})}
					</div>
				)}

				<div className={styles.list}>
					{availableFriends.length === 0 ? (
						<div className={styles.emptyState}>
							{query ? "По запросу ничего не найдено." : "Все друзья уже в группе."}
						</div>
					) : (
						availableFriends.map((friend) => {
							const isSelected = selectedIds.includes(friend.friendId);
							const username = friend.friendUsername ?? `user-${friend.friendId}`;
							const displayName = friend.friendDisplayName ?? username;

							return (
								<button
									key={friend.friendId}
									type="button"
									className={styles.friendRow}
									data-selected={isSelected}
									onClick={() => toggleUser(friend.friendId)}
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
									<span className={styles.checkbox}>{isSelected ? "✓" : ""}</span>
								</button>
							);
						})
					)}
				</div>

				<div className={styles.footer}>
					<button type="button" className={styles.secondaryButton} onClick={onClose}>
						Отмена
					</button>
					<button
						type="button"
						className={styles.primaryButton}
						disabled={selectedIds.length === 0 || isSubmitting}
						onClick={handleAdd}
					>
						<UserPlus size={17} />
						{isSubmitting ? "Добавляем..." : "Добавить"}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
