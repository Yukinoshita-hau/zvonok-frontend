import { Paperclip } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import styles from "./MessageAttachments.module.css";

interface AttachmentPickerProps {
	disabled?: boolean;
	onSelectFiles: (files: FileList) => void;
}

export function AttachmentPicker({ disabled = false, onSelectFiles }: AttachmentPickerProps) {
	const inputRef = useRef<HTMLInputElement | null>(null);

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (files?.length) onSelectFiles(files);
		event.target.value = "";
	};

	return (
		<>
			<button
				type="button"
				className={styles["picker-button"]}
				disabled={disabled}
				title="Прикрепить файлы"
				aria-label="Прикрепить файлы"
				onClick={() => inputRef.current?.click()}
			>
				<Paperclip size={19} />
			</button>
			<input
				ref={inputRef}
				type="file"
				multiple
				accept=".pdf,.txt,.md,.json,.csv,.docx,.xlsx,.pptx,.zip,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.mp3,.ogg,.m4a,.wav"
				className={styles["file-input"]}
				onChange={handleChange}
			/>
		</>
	);
}
