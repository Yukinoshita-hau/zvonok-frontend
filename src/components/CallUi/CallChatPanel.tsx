import { Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChat } from "@livekit/components-react";
import { formatTime } from "../../utils/timeHelpers";
import styles from "./CallUi.module.css";

interface CallChatPanelProps {
	isOpen: boolean;
	onClose: () => void;
}

export function CallChatPanel({ isOpen, onClose }: CallChatPanelProps) {
	const [message, setMessage] = useState("");
	const listRef = useRef<HTMLDivElement | null>(null);
	const { chatMessages, send, isSending } = useChat();

	useEffect(() => {
		if (!isOpen) return;
		listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
	}, [chatMessages, isOpen]);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = message.trim();
		if (!trimmed) return;

		await send(trimmed);
		setMessage("");
	};

	return (
		<aside
			className={styles["call-chat-panel"]}
			aria-label="Чат звонка"
			aria-hidden={!isOpen}
			data-open={isOpen}
		>
			<div className={styles["call-chat-header"]}>
				<span>Чат звонка</span>
				<button type="button" onClick={onClose} title="Закрыть чат" aria-label="Закрыть чат">
					<X size={16} />
				</button>
			</div>

			<div ref={listRef} className={styles["call-chat-messages"]}>
				{chatMessages.length === 0 ? (
					<div className={styles["call-chat-empty"]}>Сообщений пока нет</div>
				) : (
					chatMessages.map((chatMessage, index) => (
						<div className={styles["call-chat-message"]} key={chatMessage.id ?? `${chatMessage.timestamp}-${index}`}>
							<div className={styles["call-chat-meta"]}>
								<span>{chatMessage.from?.name || chatMessage.from?.identity || "Участник"}</span>
								<time>{formatTime(chatMessage.timestamp)}</time>
							</div>
							<div className={styles["call-chat-text"]}>{chatMessage.message}</div>
						</div>
					))
				)}
			</div>

			<form className={styles["call-chat-form"]} onSubmit={handleSubmit}>
				<input
					value={message}
					onChange={(event) => setMessage(event.target.value)}
					onInput={(event) => event.stopPropagation()}
					onKeyDown={(event) => event.stopPropagation()}
					placeholder="Сообщение"
					disabled={isSending}
				/>
				<button type="submit" disabled={isSending || !message.trim()} title="Отправить" aria-label="Отправить">
					<Send size={16} />
				</button>
			</form>
		</aside>
	);
}
