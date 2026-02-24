import styles from "./GroupRoomModal.module.css";
import { useEffect, useRef, useState } from "react";
import type { GroupRoomModalProps } from "./GroupRoomModal.props";


export function GroupRoomModal({ isOpen, friends, onClose, onCreate }: GroupRoomModalProps) {
	const [name, setName] = useState("");
	const [selected, setSelected] = useState<string[]>([]);
	const [isOpenDropdown, setIsOpenDropdown] = useState(false);
	const [query, setQuery] = useState("");
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const onClickOutside = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setIsOpenDropdown(false);
			}
		};
		document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, [])

	if (!isOpen) return null;

	const toggle = (username: string) => {
		setSelected(prev => {
			return prev.includes(username)
				? prev.filter(u => u !== username)
				: prev.length < 15 ? [...prev, username] : prev
		})
	};

	const filtered = friends.filter(f => f.friendUsername.toLowerCase().includes(query.toLowerCase()));

	return (
		<div className={styles["backdrop"]} onClick={onClose}>
			<div className={styles["modal"]} onClick={(e) => e.stopPropagation()}>
				<div className={styles["header"]}>Создать группу</div>

				<div className={styles["body"]}>
					<div className={styles["label"]}>Название комнаты</div>

					<input
						className={styles["input"]}
						placeholder="Название комнаты"
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
					<div className={styles["label"]}>Участники</div>
					<div className={styles["dropdown"]} ref={dropdownRef}>
						<button
							className={styles["dropdown-button"]}
							onClick={() => setIsOpenDropdown(prev => !prev)}
						>
							{selected.length > 0
								? `Выбрано: ${selected.length}`
								: "Выбрать участников"}
						</button>

						{isOpenDropdown && (
							<div className={styles["dropdown-menu"]}>
								<input
									className={styles["search"]}
									placeholder="Поиск"
									value={query}
									onChange={(e) => setQuery(e.target.value)}
								/>

								<div className={styles["list"]}>
									{filtered.map(friend => (
										<label key={friend.friendId} className={styles["checkbox"]}>
											<input
												type="checkbox"
												checked={selected.includes(friend.friendUsername)}
												onChange={() => toggle(friend.friendUsername)}
											/>
											{friend.friendUsername}
										</label>
									))}
								</div>
							</div>
						)}
					</div>

					<div className={styles["limit"]}>
						Выбрано: {selected.length} / 15
					</div>
				</div>



				<div className={styles["footer"]}>

					<button className={styles["btn-secondary"]} onClick={onClose}>Cancel</button>
					<button
						className={styles["btn-primary"]}
						onClick={() => {
							if (name.trim() && selected.length >= 2) {
								console.log(name, selected)
								onCreate({ roomName: name.trim(), roomMemberUsernames: selected });
							}
						}}
					>Create</button>
				</div>
			</div>
		</div>
	)
}
