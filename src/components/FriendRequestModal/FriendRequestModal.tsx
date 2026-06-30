import cn from "classnames";
import { Search, Send, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import styles from "./FriendRequestModal.module.css";
import type { FriendRequestModalProps } from "./FriendRequestModal.props";

export function FriendRequestModal({
	isOpen,
	onClose,
	onSubmit,
}: FriendRequestModalProps) {
	const [username, setUsername] = useState("");
	const isVisible = useModalAnimation(isOpen);
	const normalizedUsername = username.trim();

	if (!isVisible) return null;

	const handleSubmit = () => {
		if (!normalizedUsername) return;

		onSubmit(normalizedUsername);
		setUsername("");
	};

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
				<div className={styles.header}>
					<div className={styles.headerIcon}>
						<UserPlus size={20} />
					</div>
					<div>
						<h3>Добавить друга</h3>
						<p>Введите username пользователя Zvonok.</p>
					</div>
					<button
						type="button"
						className={styles.closeButton}
						onClick={onClose}
						aria-label="Закрыть"
					>
						<X size={18} />
					</button>
				</div>

				<div className={styles.body}>
					<label className={styles.label} htmlFor="friend-username">
						Username
					</label>
					<div className={styles.inputShell}>
						<Search size={17} />
						<input
							id="friend-username"
							className={styles.input}
							placeholder="например: rashid"
							value={username}
							onChange={(event) => setUsername(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									handleSubmit();
								}
							}}
							autoFocus
						/>
					</div>
					<p className={styles.hint}>
						Username - это уникальный идентификатор пользователя для нахождения его в системе.
					</p>
				</div>

				<div className={styles.footer}>
					<button
						type="button"
						className={cn(styles.btn, styles.btnSecondary)}
						onClick={onClose}
					>
						Отмена
					</button>
					<button
						type="button"
						className={cn(styles.btn, styles.btnPrimary)}
						disabled={!normalizedUsername}
						onClick={handleSubmit}
					>
						<Send size={16} />
						Отправить
					</button>
				</div>
			</div>
		</div>
	);
}
