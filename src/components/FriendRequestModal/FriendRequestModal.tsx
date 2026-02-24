import styles from "./FriendRequestModal.module.css";
import { useState } from "react";
import cn from "classnames";
import type { FriendRequestModalProps } from "./FriendRequestModal.props";


export function FriendRequestModal({ isOpen, onClose, onSubmit }: FriendRequestModalProps) {
	const [username, setUsername] = useState("");

	if (!isOpen) return null;

	return (
		<div className={styles["backdrop"]} onClick={onClose}>
			<div className={styles["modal"]} onClick={(e) => e.stopPropagation()}>
				<div className={styles["header"]}>Добавить друга</div>

				<div className={styles["body"]}>
					<div className={styles["label"]}>Username</div>
					<input
						className={styles["input"]}
						placeholder="Введите имя"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
					/>
				</div>

				<div className={styles["footer"]}>
					<button className={cn(styles["btn"], styles["btn-secondary"])} onClick={onClose}>
						Cancel
					</button>
					<button
						className={cn(styles["btn"], styles["btn-primary"])}
						onClick={() => {
							if (username.trim()) onSubmit(username.trim)
							setUsername("");
						}}
					>
						Send
					</button>
				</div>
			</div>
		</div>
	);
}
